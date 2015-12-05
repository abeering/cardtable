DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS cards;

CREATE TABLE tables ( id SERIAL );
CREATE TABLE cards ( id SERIAL, table_id INT, tablespace_coord VARCHAR, color VARCHAR );

insert into tables (id) values ( 1 );
insert into cards ( table_id, tablespace_coord, color ) values ( 1, '2:1', 'red' );
