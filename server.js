// Follow-the-money App
'use strict';

// Application Dependencies
const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
const cors = require('cors');

// Load environment variables from .env file
require('dotenv').config();

// Application Setup
const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());

// Database Setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// API Routes
app.get('/politician', getOne);
app.get('/allpoliticians', getPoliticians);
app.get('/news', getNews);


app.use('*', (request, response) => {
  response.status(404).send('you got to the wrong place');
})

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// Error handler
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// Model
function Politician(info) {
  this.tableName = 'politician';
  this.created_at = Date.now();
  this.candidate_id = info.candidate[0];
  this.candidate_name = info.candidate[1];
  this.party = info.candidate[2];
  this.size0 = info.financials[0] && info.financials[0].total || 0;
  this.size200 = info.financials[1] && info.financials[1].total || 0;
  this.size500 = info.financials[2] && info.financials[2].total || 0;
  this.size1k = info.financials[3] && info.financials[3].total || 0;
  this.size2k = info.financials[4] && info.financials[4].total || 0;
  this.totalReceipt = info.candidate[3];
}

function NewsArticle(news){
  this.source = news.source.name,
  this.author = news.author,
  this.title = news.title,
  this.description = news.description,
  this.url = news.url,
  this.urlToImage = news.urlToImage
}

Politician.lookup = politician => {
  const SQL = `SELECT * FROM politician;`;
  return client
    .query(SQL)
    .then(result => {
      if (result.rowCount > 0) {
        politician.cacheHit(result);
      } else {
        politician.cacheMiss();
      }
    })
    .catch(console.error);
};

Politician.prototype = {
  save: function() {
    const SQL = `INSERT INTO politician (created_at, candidate_id, candidate_name, party, size0, size200, size500, size1k, size2k) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING RETURNING *;`;
    const values = [this.created_at, this.candidate_id, this.candidate_name, this.party, this.size0, this.size200, this.size500, this.size1k, this.size2k];

    return client.query(SQL, values).then(result => {
      this.id = result.rows[0].id;
      return this;
    });
  }
};

function getPoliticians(req, res) {
  Politician.lookup ({
    tableName: 'politician',
    cacheHit: function (result){
      if( (Date.now() - result.rows[0].created_at) > 1000 ){ // 1157400000000
        console.log('how old-----------', result.rows[0].created_at);
        const SQL = `DELETE FROM politician;`;
        client.query(SQL)
          .then(() => {
            this.cacheMiss();
          })
      } else {
        res.send(result.rows);
      }
    },

    cacheMiss: function () {
      const url = `https://api.open.fec.gov/v1/candidates/totals/?election_full=true&per_page=60&cycle=2020&election_year=2020&sort=-receipts&api_key=${process.env.FEC_KEY}&page=1&sort_hide_null=false&sort_nulls_last=true&office=P&sort_null_only=false`;
      return superagent.get(url)
        .then(result => {
          const candidateArr = result.body.results.map(c => {
            return [c.candidate_id, c.name, c.party_full, c.receipts];  
          })
          
          const arr = candidateArr.map(candidate => {
            return superagent.get(`https://api.open.fec.gov/v1/schedules/schedule_a/by_size/by_candidate/?sort_nulls_last=false&page=1&sort_null_only=false&sort_hide_null=false&per_page=20&api_key=${process.env.FEC_KEY}&cycle=2020&candidate_id=${candidate[0]}&election_full=false`)
            .then(financialResult => {
              const allInfo = { candidate: candidate, financials: financialResult.body.results }
              // console.log(allInfo.candidate)
              const politician = new Politician(allInfo);
              console.log(politician)
              politician.save();
            })
          })
          return Promise.all(arr).then(getAll(req, res));
        })
        .catch(error => handleError(error, res))
    }
  })
}

// Get all politician from the database
function getAll(req, res){
  const SQL = `SELECT * FROM politician;`;
  client.query(SQL)
    .then(result => {
      res.send(result.rows)
    })
    .catch(error => handleError(error));
}

//Get one politician at a time
function getOne(req, res){
  const SQL = `SELECT * FROM politician WHERE candidate_name=$1;`;
  const VALUES = [req.query.name]
  client.query(SQL, VALUES)
    .then(result => {
      console.log(result)
      res.send(result.rows)
    })
    .catch(error => handleError(error));
}

function getNews(req, res){
  superagent.get(`https://newsapi.org/v2/everything?q=${req.query.name}&from=2019-07-23&sortBy=popularity&apiKey=${process.env.NEWS_KEY}`)
  .then( apiResponse => {
    console.log(apiResponse.body.articles);
    let allArticles = [];
    apiResponse.body.articles.map(article => {
      allArticles.push(new NewsArticle(article));
    });
    res.send(allArticles);
  })
}