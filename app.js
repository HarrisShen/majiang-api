const createError = require('http-errors');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');

const { nanoid } = require('nanoid');

const { startGame, act, continueGame } = require('./gameRoutine');
const { RedisManager } = require('./redisUtils');

const app = express();

const redis = require('redis');
const client = redis.createClient();
client.connect().catch(console.error);
const redisMng = new RedisManager(client);
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
    socket.emit('player:init', {self: req.session.playerID});
  }
  next();
});

const registerTableHandler = require('./tableHandler');

io.on('connection', (socket) => {
  const req = socket.request;

  socket.onAny((event, ...args) => {
    console.log('Event:', event, args);
  });

  registerTableHandler(io, socket, redisMng);

  socket.on('game:ready', async (callback) => {
    const tableID = req.session.tableID
    const playerID = req.session.playerID;
    console.log(playerID + ': readiness change');
    redisMng.changePlayerReady(playerID);
    const playerReady = await redisMng.getPlayerReady(tableID);
    io.to(tableID).emit('table:update', {playerReady: playerReady});
    callback({playerReady: playerReady});
  });

  socket.on('game:start', async () => {
    console.log('start');
    const data = await startGame();
    const gameID = data.gameID;
    console.log(gameID);
    req.session.gameID = gameID;
    console.log(req.session.playerID);
    socket.emit('game:update', data);
  });

  socket.on('game:action', async (action, pid, tid) => {
    const gameID = req.session.gameID;
    const data = await act(gameID, action, pid, tid);
    socket.emit('game:update', data);
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
