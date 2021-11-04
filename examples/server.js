const express = require('express');
const { resolve } = require('path');

const app = express();
app.use(express.static(resolve(__dirname, './virtualbackground')));
app.use(express.static(resolve(__dirname, '../dist/build')));

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
  console.log('dirname', resolve(__dirname, '../dist/build'));
  console.log('static', express.static(resolve(__dirname, '../dist/build')));
  console.log(`App server started. Go to http://localhost:${port}`);
});
