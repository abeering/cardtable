DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS cards;

CREATE TABLE tables ( id SERIAL );
CREATE TABLE cards ( id SERIAL, table_id INT, tablespace_coord VARCHAR, color VARCHAR, ordinal INT );

insert into tables (id) values ( 1 );
insert into cards ( table_id, tablespace_coord, color, ordinal ) values ( 1, '2:1', 'red', 0 );
insert into cards ( table_id, tablespace_coord, color, ordinal ) values ( 1, '2:1', 'green', 1 );
insert into cards ( table_id, tablespace_coord, color, ordinal ) values ( 1, '2:1', 'blue', 2 );
insert into cards ( table_id, tablespace_coord, color, ordinal ) values ( 1, '2:1', 'yellow', 3 );
