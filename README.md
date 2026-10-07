# Mister Hogs · SmartPOS v2

A point-of-sale system for the butchery, kitchen and tables — with a real
local server and a real SQLite database. No internet connection is required
to run it, and nothing needs to be installed beyond Node.js itself.

## Requirements

- **Node.js 22.5 or newer** (this uses Node's built-in SQLite support, so
  there is nothing else to install — no `npm install` step, no external
  database server).

Check your version with:
```
node --version
```

## Running it on Windows

Three files are included to make this easier:

- **`start.bat`** — double-click this for everyday use. It checks Node.js is
  installed, starts the server in a window (leave that window open while
  trading), and opens the till in your browser automatically after a couple
  of seconds.
- **`start-hidden.vbs`** — for making it start automatically when the
  computer turns on, with no window at all (see below).
- **`stop.bat`** — stops the server. Only needed if you used the hidden
  startup method, since `start.bat`'s window has its own Close button.

### Start automatically when Windows starts

1. Press `Win + R`, type `shell:startup`, press Enter. A folder opens.
2. Right-click **`start-hidden.vbs`** → **Create shortcut**.
3. Drag that shortcut into the folder you just opened.

From then on, SmartPOS starts silently in the background every time this
computer signs in. Open `http://localhost:4173` in a browser (worth
bookmarking) once it's had a few seconds to start. To stop it, run
`stop.bat`.

### Running it without Windows

The same `node server.js` command works identically on Mac and Linux —
`start.bat`/`start-hidden.vbs` are just Windows conveniences; nothing about
the server itself is Windows-specific. On any platform, opening a terminal
in this folder and running `node server.js` directly always works too, and
is the easiest way to see error messages if something goes wrong.

## Is it fast?

Yes, deliberately so: there's no framework overhead on the server (just
Node's own built-in `http` and `node:sqlite`), and every click in the till —
adding to a cart, opening a table, taking a payment — updates the screen
immediately from data already sitting in the browser's memory. Saving to
the database happens quietly in the background a fraction of a second
later, so nothing you do while serving a customer waits on a network
round trip or a disk write. At the scale of one shop's till, SQLite reads
and writes are effectively instant.

The first time it runs, it creates `data/smartpos.db` with sample prices and
stock so you can see how everything works. Replace the sample prices in
Settings before using it for real.

## Where your data lives

Everything — sales, stock, specials, expenses, suppliers, payroll, the audit
trail — is stored in **`data/smartpos.db`**, a single SQLite database file.
You can:
- **Back it up** by copying that one file somewhere safe (a USB drive, a
  cloud folder) while the server is stopped.
- **Inspect it** with any SQLite browser, such as the free
  [DB Browser for SQLite](https://sqlitebrowser.org/), or the `sqlite3`
  command line tool, to run your own reports.
- **Restore it** by putting a backed-up copy back as `data/smartpos.db`
  before starting the server.

The app also has its own in-app Settings → Backup screen, which exports and
imports everything as a single block of text — handy for a quick copy
without touching the database file directly.

## One computer, one till

Right now this is built for one computer running the server, with staff
using the browser on that same machine. Because it's a real local server,
if you later want a second till in the same shop talking to the same data,
the plumbing (`server.js` and `db.js`) already supports it — you'd just point
a second computer's browser at `http://<the till's network address>:4173`
instead of `localhost`, and open the port on that computer's firewall. Ask
if you'd like help setting that up.

## About the one online dependency

The interface library (React) is loaded from a content-delivery network the
first time the page opens, and is then cached by the browser, so day-to-day
use afterward doesn't need the internet. If you want this removed entirely —
so the very first run works with no internet access at all — that needs a
small local copy of those library files added to this folder; ask and this
can be set up.

## Project layout

```
server.js        the server (Node's built-in http + SQLite, no dependencies)
db.js            reads and writes data/smartpos.db
logic-seed.js    the starting sample data for a brand-new database
public/index.html   the app itself (what your browser loads)
data/            created automatically — smartpos.db lives here
```

Built for Mister Hogs.
