const createError = require('http-errors');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');

const { nanoid } = require('nanoid');

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

const io = new Server({
  cors: {
    origin: 'http://127.0.0.1:5500',
  }
});

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
const registerGameHandler = require('./gameHandler');

io.on('connection', (socket) => {
  socket.onAny((event, ...args) => {
    console.log('Event:', event, args);
  });

  registerTableHandler(io, socket, redisMng);
  registerGameHandler(io, socket, redisMng);
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
