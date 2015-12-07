var utils = require('../utils'); // util library
var pgp = require('pg-promise')(); // for escaping things

module.exports = function(database_handle){
  return {
    putNewCardsOnTablespace: function(cards, tablespace_coord, callback){
      putNewCardsOnTablespace(database_handle, cards, tablespace_coord, callback);
    },
    loadTableState: function(callback){
      loadTableState(database_handle, callback);
    },
    moveCardPosition: function(data, callback){
      moveCardPosition(database_handle, data, callback);
    },
    pileTablespace: function(data, callback){
      pileTablespace(database_handle, data, callback);
    }
  }
}

function loadTableState(db, callback){
  var sql = `
    WITH pile_data AS (
      SELECT pile, MAX(ordinal) AS pile_max_ordinal, COUNT(1) AS cards_in_pile
      FROM cards
      WHERE
        pile IS NOT NULL
      GROUP BY pile
    )

    SELECT cards.id, cards.tablespace_coord, cards.front_markup, cards.back_markup, cards.color, cards.ordinal, cards.pile, pile_data.cards_in_pile
    FROM cards
    JOIN pile_data ON pile_data.pile_max_ordinal = cards.ordinal AND pile_data.pile = cards.pile

    UNION

    SELECT cards.id, cards.tablespace_coord, cards.front_markup, cards.back_markup, cards.color, cards.ordinal, cards.pile, 1 AS cards_in_pile
    FROM cards
    WHERE
      pile IS NULL
  `;

  db.query(sql).then(function(data){
    table_data = {};
    data.map(function(card){
      if(table_data[card.tablespace_coord]){
        table_data[card.tablespace_coord]['cards'].push(card);
      } else {
        table_data[card.tablespace_coord] = {};
        table_data[card.tablespace_coord]['cards'] = [card];
      }
    });
    callback(null, table_data);
  }).catch(function(error){
    callback(error, false);
  });
}

function putNewCardsOnTablespace(db, cards, tablespace_coord, callback){
  // shuffle, then apply ordinals
  utils.shuffle(cards);
  cards = cards.map(function(card,i){
    return { front_markup: card.front_markup, back_markup: card.back_markup, ordinal: i };
  });

  _putCardPileOnTablespace(db, cards, tablespace_coord, function(err, data){
    if(err){
      console.error('error putting cards on tablespace', error);
    } else {
      loadTableState(db, callback);
    }
  });
}

function moveCardPosition(db, request_data, callback){
    // if we're moving from one tablespace to another, things are a bit more complicated
    if(request_data['oldTablespaceId'] != request_data['newTablespaceId']){

      // get data about both tablespaces so we can reorder them and move the card between them
      query_data = _tablespacesDataQuery([request_data['newTablespaceId'], request_data['oldTablespaceId']]);
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
          query_data = _moveCardToNewOrdinalQuery(
            request_data['oldTablespaceId'],
            request_data['cardId'],
            request_data['oldOrdinal'],
            (tablespace_data[request_data['oldTablespaceId']]['max_ordinal'])
          );
          queries.push(t.any(query_data.query, query_data.args));
          // move card to end of new tablespace
          query_data = _moveCardToNewTablespaceQuery(
            request_data['oldTablespaceId'],
            request_data['cardId'],
            request_data['newTablespaceId'],
            (tablespace_data[request_data['newTablespaceId']]) ? (tablespace_data[request_data['newTablespaceId']]['max_ordinal'] + 1) : 0
          );
          queries.push(t.any(query_data.query, query_data.args));
          // move card to requested ordinal in new tablespace
          query_data = _moveCardToNewOrdinalQuery(
            request_data['newTablespaceId'],
            request_data['cardId'],
            (tablespace_data[request_data['newTablespaceId']]) ? (tablespace_data[request_data['newTablespaceId']]['max_ordinal'] + 1) : 0,
            request_data['newOrdinal']
          );
          queries.push(t.any(query_data.query, query_data.args));

          // run all queries in batch
          return t.batch([queries]);
        }).then(function(data){
          loadTableState(db, callback);
        }).catch(function(error){
          callback(error, false);
        });
      }).catch(function(error){
        callback(error, false);
      });

    } else {

      // no need to move things between tablespaces, just re-order this tablespace
      query_data = _moveCardToNewOrdinalQuery(
        request_data['newTablespaceId'],
        request_data['cardId'],
        request_data['oldOrdinal'],
        request_data['newOrdinal']
      );
      db.query(
        query_data.query, query_data.args
      ).then(function(data){
        loadTableState(db, callback);
      }).catch(function(error){
        callback(error, false);
      });

    }
}


function pileTablespace(db, data, callback){
  var pile_string = new Date().getTime();
  sql = `
    UPDATE cards SET pile = $1 WHERE tablespace_coord = $2
  `;
  db.query(
    sql, [pile_string, data['tablespaceId']]
  ).then(function(data){
    loadTableState(db, callback);
  }).catch(function(error){
    callback(error, false);
  });
}


function _putCardPileOnTablespace(db, cards, tablespace_coord, callback){
  var pile_string = new Date().getTime();
  var insert_values = cards.map(function(card){
    return '(' + [
      pgp.as.text(tablespace_coord),
      pgp.as.text(card.front_markup),
      pgp.as.text(card.back_markup),
      card.ordinal,
      pgp.as.text(pile_string),
      false
    ].join(',') + ')'
  });
  var sql = `
    INSERT INTO cards ( tablespace_coord, front_markup, back_markup, ordinal, pile, face_up )
    VALUES
    ${insert_values.join(',')}
  `;
  db.query(sql).then(function(data){
    callback(null, true);
  }).catch(function(error){
    callback(error, false)
  });
}

function _moveCardToNewOrdinalQuery(tablespace_coord, card_id, old_ordinal, new_ordinal){
  var sql;
  if(old_ordinal > new_ordinal){
    sql = `
      UPDATE cards
        SET
        pile = NULL,
        ordinal = CASE
          WHEN id = $1::INT THEN
            $3
          ELSE
            ordinal + 1
        END
      WHERE
        ordinal <= $2::INT AND ordinal >= $3::INT
        AND tablespace_coord = $4::VARCHAR
    `;
  } else {
    sql = `
      UPDATE cards
        SET
        pile = NULL,
        ordinal = CASE
          WHEN id = $1::INT THEN
            $3
          ELSE
            ordinal - 1
        END
      WHERE
        ordinal >= $2::INT AND ordinal <= $3::INT
        AND tablespace_coord = $4::VARCHAR
      `;
  }
  var arg_array = [ card_id, old_ordinal, new_ordinal, tablespace_coord ];
  return { query: sql, args: arg_array };
}

function _moveCardToNewTablespaceQuery(old_tablespace_coord, card_id, new_tablespace_coord, tail_ordinal){
  var sql = `
    UPDATE cards
      SET tablespace_coord = $3,
      ordinal = $4::INT,
      pile = NULL
    WHERE
      id = $1::INT
      AND tablespace_coord = $2
  `;
  var arg_array = [ card_id, old_tablespace_coord, new_tablespace_coord, tail_ordinal ];
  return { query: sql, args: arg_array };
}

function _tablespacesDataQuery(tablespace_coords){
  var sql = `
    SELECT
      tablespace_coord,
      MAX(ordinal)::INT AS max_ordinal,
      COUNT(1)::INT AS total_cards
    FROM cards
    WHERE
      tablespace_coord IN ($1^)
    GROUP BY tablespace_coord
  `;
  var arg_array = [ pgp.as.csv(tablespace_coords) ];
  return { query: sql, args: arg_array };
}
