//var pg = require('pg');
var fs = require('fs');
var path = require('path');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

// web setup
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// db setup
var pg_server = process.env.DATABASE_URL || 'localhost';
var pg_conn_string = "postgres://" + pg_server + "/cardtable";
var pgp = require('pg-promise')(/*options*/);
var db = pgp(pg_conn_string);

// socket.io setup
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
server.listen(3000);

io.sockets.on('connection', function (socket) {

  var table_id;

  // init table connection
  socket.on('initTable', function(table_id_param){
    table_id = table_id_param;
    emitTableState(table_id, io);
  });

  // update table data
  socket.on('moveCardPosition', function(data){
    moveCardPosition(table_id, io, data);
  });

});

function emitTableState(table_id, io){

  db.query('SELECT cards.* FROM cards WHERE cards.table_id = $1::INT', table_id)
    .then(function(data){
        table_data = {};
        data.map(function(card){
          if(table_data[card.tablespace_coord]){
            table_data[card.tablespace_coord]['cards'].push({ id: card.id, color: card.color, ordinal: card.ordinal });
          } else {
            table_data[card.tablespace_coord] = {};
            table_data[card.tablespace_coord]['cards'] = [ { id: card.id, color: card.color, ordinal: card.ordinal } ];
          }
        });

        io.emit('updateTable', table_data);
    })
    .catch(function(error){
        console.error('error running query', error);
    });

}

function moveCardToNewOrdinalQuery(table_id, tablespace_coord, card_id, old_ordinal, new_ordinal){
  var sql;
  if(old_ordinal > new_ordinal){
    sql = `
      UPDATE cards
        SET ordinal = CASE
          WHEN id = $2::INT THEN
            $4
          ELSE
            ordinal + 1
        END
      WHERE
        ordinal <= $3::INT AND ordinal >= $4::INT
        AND tablespace_coord = $5::VARCHAR
        AND table_id = $1::INT
    `;
  } else {
    sql = `
      UPDATE cards
        SET ordinal = CASE
          WHEN id = $2::INT THEN
            $4
          ELSE
            ordinal - 1
        END
      WHERE
        ordinal >= $3::INT AND ordinal <= $4::INT
        AND tablespace_coord = $5::VARCHAR
        AND table_id = $1::INT
      `;
  }
  var arg_array = [ table_id, card_id, old_ordinal, new_ordinal, tablespace_coord ];
  return { query: sql, args: arg_array };
}

function moveCardToNewTablespace(table_id, old_tablespace_coord, card_id, new_tablespace_coord, tail_ordinal){
  var sql = `
    UPDATE cards
      SET tablespace_coord = $4,
      ordinal = $5::INT
    WHERE
      id = $2::INT
      AND table_id = $1::INT
      AND tablespace_coord = $3
  `;
  var arg_array = [ table_id, card_id, old_tablespace_coord, new_tablespace_coord, tail_ordinal ];
  return { query: sql, args: arg_array };
}

function tablespacesDataQuery(table_id, tablespace_coords){
  var sql = `
    SELECT
      tablespace_coord,
      MAX(ordinal)::INT AS max_ordinal,
      COUNT(1)::INT AS total_cards
    FROM cards
    WHERE
      tablespace_coord IN ($1^)
      AND table_id = $2::INT
    GROUP BY tablespace_coord
  `;
  var arg_array = [ pgp.as.csv(tablespace_coords), table_id ];
  return { query: sql, args: arg_array };
}

function moveCardPosition(table_id, io, request_data){
    // if we're moving from one tablespace to another, things are a bit more complicated
    if(request_data['oldTablespaceId'] != request_data['newTablespaceId']){

      // get data about both tablespaces so we can reorder them and move the card between them
      query_data = tablespacesDataQuery(table_id, [request_data['newTablespaceId'], request_data['oldTablespaceId']]);
      db.query(
        query_data.query, query_data.args
      ).then(function(data){

        // unfold the data a bit for ease
        var tablespace_data = {};
        data.forEach(function(tablespace){ tablespace_data[tablespace.tablespace_coord] = tablespace; });

        // prepping for multiple queries in transaction
        var queries = [];
        var query_data;
        db.tx(function(t){
          // query move card to end of old tablespace
          query_data = moveCardToNewOrdinalQuery(
            table_id,
            request_data['oldTablespaceId'],
            request_data['cardId'],
            request_data['oldOrdinal'],
            (tablespace_data[request_data['oldTablespaceId']]['max_ordinal'])
          );
          queries.push(t.any(query_data.query, query_data.args));
          // move card to end of new tablespace
          query_data = moveCardToNewTablespace(
            table_id,
            request_data['oldTablespaceId'],
            request_data['cardId'],
            request_data['newTablespaceId'],
            (tablespace_data[request_data['newTablespaceId']]) ? (tablespace_data[request_data['newTablespaceId']]['max_ordinal'] + 1) : 0
          );
          queries.push(t.any(query_data.query, query_data.args));
          // move card to requested ordinal in new tablespace
          query_data = moveCardToNewOrdinalQuery(
            table_id,
            request_data['newTablespaceId'],
            request_data['cardId'],
            (tablespace_data[request_data['newTablespaceId']]) ? (tablespace_data[request_data['newTablespaceId']]['max_ordinal'] + 1) : 0,
            request_data['newOrdinal']
          );
          queries.push(t.any(query_data.query, query_data.args));

          // run all queries in batch
          return t.batch([queries]);
        }).then(function(data){
          emitTableState(table_id, io);
        }).catch(function(error){
          console.error('error running query df', error);
        });
      }).catch(function(error){
        console.error('error running query', error);
      });

    } else {

      // no need to move things between tablespaces, just re-order this tablespace
      query_data = moveCardToNewOrdinalQuery(
        table_id,
        request_data['newTablespaceId'],
        request_data['cardId'],
        request_data['oldOrdinal'],
        request_data['newOrdinal']
      );
      db.query(
        query_data.query, query_data.args
      ).then(function(data){
        emitTableState(table_id, io);
      }).catch(function(error){
        console.error('error running query', error);
      });

    }
}

app.listen(app.get('port'), function() {
  console.log('Server started: http://localhost:' + app.get('port') + '/');
});
