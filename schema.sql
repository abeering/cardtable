DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS cards;

CREATE TABLE tables ( id SERIAL );
CREATE TABLE cards ( id SERIAL, table_id INT, tablespace_coord VARCHAR, markup VARCHAR, color VARCHAR, ordinal INT, pile VARCHAR );

insert into tables (id) values ( 1 );
insert into cards ( table_id, tablespace_coord, color, ordinal, pile ) values ( 1, '1:1', 'red', 0, NULL );
insert into cards ( table_id, tablespace_coord, color, ordinal, pile ) values ( 1, '2:1', 'green', 0, 'foo' );
insert into cards ( table_id, tablespace_coord, color, ordinal, pile ) values ( 1, '2:1', 'blue', 1, 'foo' );
insert into cards ( table_id, tablespace_coord, color, ordinal, pile ) values ( 1, '2:1', 'yellow', 2, 'foo' );
