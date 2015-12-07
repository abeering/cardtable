DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS cards;

CREATE TABLE tables ( id SERIAL );
CREATE TABLE cards (
  id SERIAL,
  tablespace_coord VARCHAR,
  front_markup VARCHAR,
  back_markup VARCHAR,
  color VARCHAR,
  ordinal INT,
  pile VARCHAR,
  face_up BOOLEAN
);

insert into tables (id) values ( 1 );
insert into cards ( tablespace_coord, color, ordinal, pile, face_up ) values ( '1:1', 'red', 0, NULL, true );
insert into cards ( tablespace_coord, color, ordinal, pile, face_up ) values ( '2:1', 'green', 0, NULL, true );
insert into cards ( tablespace_coord, color, ordinal, pile, face_up ) values ( '2:1', 'blue', 1, NULL, true );
insert into cards ( tablespace_coord, color, ordinal, pile, face_up ) values ( '2:1', 'yellow', 2, NULL, true );
