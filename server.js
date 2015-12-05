var pg = require('pg');
var fs = require('fs');
var path = require('path');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var pg_con_string = "postgres://localhost/cardtable";

app.use('/', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// socket.io
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
  console.log('emit table state');
  pg.connect(pg_con_string, function(err, client, done) {
    if (err) {
      return console.error('error fetching client from pool', err);
    }
    client.query(
      'SELECT cards.* FROM cards WHERE cards.table_id = $1::INT',
      [table_id],
    function(err, result){
      done();
      if (err) {
        return console.error('error running query', err);
      }

      table_data = {};
      result.rows.map(function(card){
        if(table_data[card.tablespace_coord]){
          table_data[card.tablespace_coord]['cards'].push({ id: card.id, color: card.color });
        } else {
          table_data[card.tablespace_coord] = {};
          table_data[card.tablespace_coord]['cards'] = [ { id: card.id, color: card.color } ];
        }
      });

      io.emit('updateTable', table_data);
    });
  });
}

function moveCardPosition(table_id, io, data){
  console.log('move card position');
  pg.connect(pg_con_string, function(err, client, done) {
    if (err) {
      return console.error('error fetching client from pool', err);
    }
    client.query(
      'UPDATE cards SET tablespace_coord = $1::VARCHAR WHERE table_id = $2::INT AND id = $3::INT',
      [data['newTablespaceId'], table_id, data['cardId']],
    function(err, result){
      done();
      if (err) {
        return console.error('error running query', err);
      }

      emitTableState(table_id, io);

    });
  });
}

app.listen(app.get('port'), function() {
  console.log('Server started: http://localhost:' + app.get('port') + '/');
});
