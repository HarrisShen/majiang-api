const createError = require('http-errors');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const gameRouter = require('./routes/game');

const app = express();

const redis = require('redis');
const client = redis.createClient({ legacyMode: true });
client.connect().catch(console.error);
const RedisStore = require('connect-redis')(session);

app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'keyboard cat',
  store: new RedisStore({client: client})
}));

const io = new Server();

io.on('connect', (socket) => {
  socket.on('connect', () => {
    console.lof('SOCKET connected');
  });
})

app.use(function(req, res, next) {
  req.io = io;
  return next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/game', gameRouter);

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
