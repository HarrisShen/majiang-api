const initAction = (initCallback = () => false) => ({
    pong: initCallback(),
    kong: initCallback(),
    chow: initCallback(),
    hu: initCallback(),
  });

  module.exports = initAction;