const createError = require('http-errors');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');

const { nanoid } = require('nanoid');

const { startGame, act, continueGame } = require('./gameRoutine');
const { createTable, tableExists, addPlayer, getPlayers, removePlayer } = require('./controller');

const app = express();

// const redis = require('redis');
// const client = redis.createClient({ legacyMode: true });
// client.connect().catch(console.error);
// const RedisStore = require('connect-redis')(session);

const sessionMiddleware = session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'keyboard cat',
});

app.use(sessionMiddleware);

const io = new Server();

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));

io.use((socket, next) => {
  const req = socket.request;
  if(!req.session.playerID) {
    req.session.playerID = 'User-' + nanoid(8);
  }
  next();
});

io.on('connection', (socket) => {
  const req = socket.request;

  socket.onAny((event, ...args) => {
    console.log('Event:', event, args);
  });

  socket.on('table:create', async (callback) => {
    console.log('create table');
    const tableID = await createTable();
    req.session.tableID = tableID;
    socket.join(tableID);
    console.log('table created: ' + tableID);
    await addPlayer(tableID, req.session.playerID);
    callback({tableID: tableID, players: [req.session.playerID]});
  });

  socket.on('table:leave', async (callback) => {
    console.log('leave table');
    const tableID = req.session.tableID;
    req.session.tableID = '';
    await removePlayer(tableID, req.session.playerID);
    socket.leave(tableID);
    const players = await getPlayers(tableID);
    console.log(players);
    console.log('table:' + tableID + ' left');
    io.to(tableID).emit('table:update', {players: players});
    callback({tableID: req.session.tableID});
  });

  socket.on('table:join', async (tableID, callback) => {
    console.log('joining table');
    if(!req.session.playerID) {
      req.session.playerID = 'User-' + nanoid(8);
    }
    try {
      await addPlayer(tableID, req.session.playerID);
    } catch (error) {
      console.log(error.message);
      callback({error: error.message});
      return;
    }
    req.session.tableID = tableID;
    socket.join(tableID);
    const players = await getPlayers(tableID);
    console.log(players);
    console.log('table:' + tableID + ' joined');
    io.to(tableID).emit('table:update', {players: players});
    callback({players: players});
  });

  socket.on('game:start', async () => {
    console.log('start');
    const data = await startGame();
    const gameID = data.gameID;
    console.log(gameID);
    req.session.gameID = gameID;
    console.log(req.session.playerID);
    socket.emit('update', data);
  });

  socket.on('game:action', async (action, pid, tid) => {
    const gameID = req.session.gameID;
    const data = await act(gameID, action, pid, tid);
    socket.emit('update', data);
    await continueGame(gameID, socket);
  });
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = { app, io };
