# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **data repository** — a Notion expense tracker export with no application code. All data is in `/data/`.

## Data Structure

### Files
- `data/Expenses *_all.csv` — full chronological expense records (~175 rows)
- `data/Untitled *.csv` — alternate exports of the same data (different column order or sort)
- `data/Category *_all.csv` — category summary records
- `data/Expense Tracker *.md` — Notion page export (not documentation)

The CSV files are duplicate exports of the same underlying Notion database, not distinct datasets.

### Expenses Schema
Columns: `Expense`, `Amount`, `Category`, `Date`

- **Amount**: formatted as `"₱#,###.##"` (Philippine Peso, quoted string with peso sign and comma separators)
- **Date**: formatted as `"Month D, YYYY"` (e.g., `"February 20, 2025"`)
- **Category**: contains embedded Notion hyperlinks — format is `"Category Name (https://www.notion.so/...)"` — the actual category name must be extracted from before the first ` (`
- Date range: approximately February 2025 – February 2026

### Categories
- Transport, Housing, Entertainment, Food & Drinks, Groceries, Credit Cards and Loans, Subscriptions, Laguna Waters

## Data Quirks
- Some expense rows have empty `Amount` and `Date` fields
- Category column values are not plain strings — they embed Notion URLs that must be stripped when parsing
- Amount strings require stripping `₱` and `,` before numeric conversion
