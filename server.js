var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var pg = require('pg');
var app = express();

var pg_con_string = "postgres://localhost/cardtable";

app.set('port', (process.env.PORT || 3000));

app.use('/', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// get table information to render entire table
app.get('/api/table/:table_id', function(req, res) {

  pg.connect(pg_con_string, function(err, client, done) {
    if (err) {
      return console.error('error fetching client from pool', err);
    }
    client.query(
      'SELECT cards.* FROM cards WHERE cards.table_id = $1::INT',
      [req.params.table_id],
      function(err, result){
      done();
      if (err) {
        return console.error('error running query', err);
      }

      if(!result){
        res.status(404).end();
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

      res.setHeader('Cache-Control', 'no-cache');
      res.json({ tablespaces: table_data });
    });

  });
});

// move a card to another position
app.get('/api/table/:table_id/move/:card_id/to/:tablespace_coord', function(req,res) {

  pg.connect(pg_con_string, function(err, client, done) {
    if (err) {
      return console.error('error fetching client from pool', err);
    }
    client.query(
      'UPDATE cards SET tablespace_coord = $1::VARCHAR WHERE table_id = $2::INT AND id = $3::INT',
      [req.params.tablespace_coord, req.params.table_id, req.params.card_id],
      function(err, result){
      done();
      if (err) {
        return console.error('error running query', err);
      }
      console.log(result);

      if(!result){
        res.status(404).end();
      }

      res.setHeader('Cache-Control', 'no-cache');
      res.json({ status: 'ok' });
    });

  });

});

app.listen(app.get('port'), function() {
  console.log('Server started: http://localhost:' + app.get('port') + '/');
});
