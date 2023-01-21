const createError = require('http-errors');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');

const { nanoid } = require('nanoid');

// const indexRouter = require('./routes/index');
// const usersRouter = require('./routes/users');
// const gameRouter = require('./routes/game');

const { startGame, act, continueGame } = require('./gameRoutine');

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

io.on('connection', (socket) => {
  const req = socket.request;

  socket.onAny((event, ...args) => {
    console.log('Event:', event, args);
  });

  socket.on('table:create', (callback) => {
    console.log('create table');
    const tableID = nanoid(4);
    req.session.tableID = tableID;
    callback({tableID: tableID});
  });

  socket.on('table:leave', (callback) => {
    console.log('leave table');
    req.session.tableID = '';
    callback({tableID: req.session.tableID});
  });

  socket.on('start', async () => {
    console.log('start');
    const data = await startGame();
    const gameID = data.gameID;
    console.log(gameID);
    req.session.gameID = gameID;
    if(!req.session.playerID) {
      const playerID = nanoid(8);
      data.playerID = playerID;
      req.session.playerID = playerID;
    }
    console.log(req.session.playerID);
    socket.emit('update', data);
  });

  socket.on('action', async (action, pid, tid) => {
    const gameID = req.session.gameID;
    const data = await act(gameID, action, pid, tid);
    socket.emit('update', data);
    await continueGame(gameID, socket);
  });
});

// app.use(function(req, res, next) {
//   req.io = io;
//   return next();
// });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// app.use('/', indexRouter);
// app.use('/users', usersRouter);
// app.use('/game', gameRouter);

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
