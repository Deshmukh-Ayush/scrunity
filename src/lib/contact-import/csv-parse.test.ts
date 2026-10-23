import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CsvParseError, parseCsv, sniffDelimiter } from "./csv-parse"

describe("parseCsv", () => {
  it("strips a UTF-8 byte order mark from the first header", () => {
    const { headers } = parseCsv("﻿Email,Name\nana@acme.example,Ana")
    assert.deepEqual(headers, ["Email", "Name"])
  })

  it("reads semicolon files (Excel in European locales)", () => {
    const parsed = parseCsv("Email;Company\nana@acme.example;Acme, Inc.\n")
    assert.equal(parsed.delimiter, ";")
    assert.deepEqual(parsed.rows, [["ana@acme.example", "Acme, Inc."]])
  })

  it("keeps commas inside quoted fields and unescapes doubled quotes", () => {
    const { rows } = parseCsv('Name,Notes\n"Ortiz, Ana","Said ""yes"" twice"\n')
    assert.deepEqual(rows, [["Ortiz, Ana", 'Said "yes" twice']])
  })

  it("keeps a line break inside a quoted field and numbers rows by their first line", () => {
    const { rows, lineNumbers } = parseCsv('Name,Notes\r\nAna,"line one\r\nline two"\r\nBen,ok\r\n')
    assert.deepEqual(rows, [["Ana", "line one\r\nline two"], ["Ben", "ok"]])
    assert.deepEqual(lineNumbers, [2, 4])
  })

  it("drops blank rows, including rows of empty delimiters (Sheets exports)", () => {
    const { rows } = parseCsv("Email,Name\n\nana@acme.example,Ana\n,\n   \nben@acme.example,Ben\n")
    assert.equal(rows.length, 2)
  })

  it("renames duplicate and empty headers so every column keeps its own key", () => {
    const { headers } = parseCsv("Email,email,,Name\na@x.example,b@x.example,c,d")
    assert.deepEqual(headers, ["Email", "email (2)", "Column 3", "Name"])
  })

  it("pads short rows and cuts long ones to the header length", () => {
    const { rows } = parseCsv("A,B,C\n1\n1,2,3,4\n")
    assert.deepEqual(rows, [["1", "", ""], ["1", "2", "3"]])
  })

  it("reports the line of an unclosed quote", () => {
    assert.throws(
      () => parseCsv('Name,Notes\nAna,ok\nBen,"never closed\nCara,x\n'),
      (err: unknown) => err instanceof CsvParseError && err.code === "unterminated_quote" && err.line === 3
    )
  })

  it("refuses binary content and files with no header", () => {
    assert.throws(() => parseCsv("PK\u0003\u0004\u0000\u0000"), (err: unknown) => err instanceof CsvParseError && err.code === "binary_content")
    assert.throws(() => parseCsv("\n\n  \n"), (err: unknown) => err instanceof CsvParseError && err.code === "no_header")
  })

  it("sniffs the delimiter from the first line outside quotes", () => {
    assert.equal(sniffDelimiter('"a;b;c",d\n'), ",")
    assert.equal(sniffDelimiter("a;b;c\n"), ";")
    assert.equal(sniffDelimiter("a\tb\tc\n"), "\t")
  })
})
