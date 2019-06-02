import { Snippet } from "../text/snippets.js";

export var snippets = [
  ["schema", "SELECT column_name, data_type, character_maximum_length\nFROM information_schema.columns WHERE table_name = '${0:dbname}';"],
  ["tables", "SELECT table_name\nFROM information_schema.tables\nWHERE table_schema = 'public';"],
  ['table',
   "CREATE TABLE name(\n"
   + "   id INT PRIMARY KEY     NOT NULL,\n"
   + "   name           TEXT    NOT NULL\n"
   + ");"
  ],
  ["addcol", "ALTER TABLE ${0:table} ADD ${1:column} ${2:type};"],
  ["dropcol", "ALTER TABLE ${0:table} DROP COLUMN ${1:column};"],
  ["modcol", "ALTER TABLE addresses ALTER COLUMN id TYPE int;"],
  ["addconstraint", "ALTER TABLE tableADD CONSTRAINT table_pk PRIMARY KEY (id);"],
  ["update", "UPDATE table_name\nSET column1 = value1, columnN = valueN\nWHERE [condition];"],
  ["ccol", "${0:name}	varchar2(${1:size})	${2:default ''}	${3:not null}"],
  ["ncol", "${0:name}	number	${2:default 0}	${3:not null}"],
  ["dcol", "${0:name}	date	${2:default sysdate}	${3:not null}"],
  ["col", "${0:name}	${1:type}	${2:default ''}	${3:not null}"],
  ["uind", "CREATE UNIQUE index ${0:name} ON ${1:table}(${2:column});"],
  ["ind", "CREATE INDEX ${2:$1_$2} on ${0:table}(${1:column});"],
  ["tblcom", "COMMENT ON table ${0:table} IS '${1:comment}';"],
  ["colcom", "COMMENT ON column ${0:table}.${1:column} is '${2:comment}';"],
  ["seq", "CREATE SEQUENCE ${0:name} START WITH ${1:1} INCREMENT BY ${2:1} MINVALUE ${3:1};"],
  ["ins", "INSERT INTO ${0:table_name} (${1:column})\nVALUES (${2:value}), (${3:value});"],
  ["s*", "SELECT * FROM ${0:table}"]
]