// Follow-the-money App
'use strict';

// Application Dependencies
const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
const cors = require('cors');
const OAuth = require('oauth').OAuth;
const qs = require('qs');

// Load environment variables from .env file
require('dotenv').config();
require('twitter-node-client').Twitter;

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
app.get('/allpoliticians', makePoliticians);
app.get('/news', getNews);
app.get('/twitter', getTweets); 

// Client-error route
app.use('*', (request, response) => {
  response.status(404).send('you got to the wrong place');
})

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on ${PORT}`));


// Callback functions >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

function handleError(err, res) {
  console.error('ERROR [%s]', err);
  // if (res) res.status(500).send('Sorry, something went wrong');
}

const success = function (res) {
  return data => {
    let tweetArr = JSON.parse(data).statuses.map(tweet => {
      return [tweet.created_at, tweet.text, tweet.user.name, tweet.user.screen_name, tweet.user.description, tweet.user.url, tweet.user.profile_image_url];
    })
    res.send(tweetArr);
  }
};

// Models >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

function Twitter() {
  this.consumerKey = process.env.CONSUMER_KEY;
  this.consumerSecret = process.env.CONSUMER_SECRET;
  this.accessToken = process.env.ACCESS_TOKEN;
  this.accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
  this.callBackUrl = 'https://follow-the-money-server.herokuapp.com/twitter/callback/'; 
  this.baseUrl = 'https://api.twitter.com/1.1';
  this.oauth = new OAuth(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      this.consumerKey,
      this.consumerSecret,
      '1.0',
      this.callBackUrl,
      'HMAC-SHA1'
  );
}

// FEC >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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
    const SQL = `INSERT INTO politician (created_at, candidate_id, candidate_name, party, size0, size200, size500, size1k, size2k, totalReceipt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING RETURNING *;`;
    const values = [this.created_at, this.candidate_id, this.candidate_name, this.party, this.size0, this.size200, this.size500, this.size1k, this.size2k, this.totalReceipt];

    return client.query(SQL, values).then(result => {
      this.id = result.rows[0].id;
      return this;
    });
  }
};

function makePoliticians(req, res) {
  Politician.lookup ({
    tableName: 'politician',
    cacheHit: function (result){
      if( (Date.now() - result.rows[0].created_at) > 1157400000000 ){ 
        console.log('how old-----------', result.rows[0].created_at);
        const SQL = `DELETE FROM politician;`;
        client.query(SQL)
          .then(() => {
            console.log('im in here')
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
              const politician = new Politician(allInfo);
              politician.save();
            })
          })
          return Promise.all(arr).then(getAll(req, res))
        })
        .catch(error => handleError(error, res))
    }
  })
}

// Get all politicians from the database
function getAll(req, res){
  const SQL = `SELECT * FROM politician;`;
  client.query(SQL)
    .then(result => {
      res.send(result.rows)
    })
    .catch(error => handleError(error));
}

// Get one politician from the database
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

// NEWS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

// TWITTER >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Methods from this reference: https://github.com/BoyCook/TwitterJSClient
const twitter = new Twitter();

Twitter.prototype.getOAuthRequestToken = function (next) {
  this.oauth.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret, results) {
      if (error) {
          console.log('ERROR: ' + error);
          next();
      }
      else {
          var oauth = {};
          oauth.token = oauth_token;
          oauth.token_secret = oauth_token_secret;
          console.log('oauth.token: ' + oauth.token);
          console.log('oauth.token_secret: ' + oauth.token_secret);
          next(oauth);
      }
  });
};

Twitter.prototype.getOAuthAccessToken = function (oauth, next) {
  this.oauth.getOAuthAccessToken(oauth.token, oauth.token_secret, oauth.verifier,
      function (error, oauth_access_token, oauth_access_token_secret, results) {
          if (error) {
              console.log('ERROR: ' + error);
              next();
          } else {
              oauth.access_token = oauth_access_token;
              oauth.access_token_secret = oauth_access_token_secret;

              console.log('oauth.token: ' + oauth.token);
              console.log('oauth.token_secret: ' + oauth.token_secret);
              console.log('oauth.access_token: ' + access_token.token);
              console.log('oauth.access_token_secret: ' + oauth.access_token_secret);
              next(oauth);
          }
      }
  );
};

Twitter.prototype.getSearch = function (params, error, success) {
  var encodedQuery = encodeURIComponent(params.q);
  delete params.q;
  var path = '/search/tweets.json?q=' + encodedQuery +'&'+ qs.stringify(params);
  var url = this.baseUrl + path;
  this.doRequest(url, error, success);
};

Twitter.prototype.doRequest = function (url, error, success) {
  // Fix the mismatch between OAuth's  RFC3986's and Javascript's beliefs in what is right and wrong ;)
  // From https://github.com/ttezel/twit/blob/master/lib/oarequest.js
  url = url.replace(/\!/g, "%21")
          .replace(/\'/g, "%27")
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
          .replace(/\*/g, "%2A");

  this.oauth.get(url, this.accessToken, this.accessTokenSecret, function (err, body, response) {
      console.log('URL [%s]', url);
      console.log('response.statusCode', response.statusCode)
      if (!err && response.statusCode == 200) {
          success(body);
      } else {
          handleError(err, response, body);
      }
  });

};

function getTweets(req, res) {
  twitter.getSearch({'q':'from:realDonaldTrump OR from:BetoORourke OR from:KamalaHarris OR from:JoeBiden OR from:PeteButtigieg OR from:BernieSanders OR from:AndrewYang OR from:CoryBooker OR from:JayInslee OR from:SenWarren OR from:ewarren OR from:JulianCastro OR from:BilldeBlasio OR from:TulsiGabbard OR from:JohnDelaney OR from:SenGillibrand OR from:amyklobuchar OR from:RepSwalwell','count': 18, 'src': 'typed_query', 'f': 'live'}, handleError, success(res))
}

