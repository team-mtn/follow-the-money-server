'use strict';
// Follow-the-money App

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
app.get('/politician', getPolitician);
// app.get('/area', getArea);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// Error handler
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// Look for the results in the database
// function lookup(options) {
//   const SQL = `SELECT * FROM ${options.tableName} WHERE candidate_id=$1;`;
//   const values = [options.candidate_name];

//   client
//     .query(SQL, values)
//     .then(result => {
//       if (result.rowCount > 0) {
//         options.cacheHit(result, options.cacheMiss);
//       } else {
//         options.cacheMiss();
//       }
//     })
//     .catch(error => handleError(error));
// }

// Models;
function Politician(res) {
  this.tableName = 'politician';
  this.created_at = Date.now();
  this.candidate_id = res.candidate.candidate_id;
  this.candidate_name = res.candidate.name;
  this.party = res.candidate.party_full;
  this.size0 = res.financials[0].size;
  this.size200 = res.financials[1].size;
  this.size500 = res.financials[2].size;
  this.size1k = res.financials[3].size;
  this.size2k = res.financials[4].size;
}

// Politician.lookupPolitician = politician => {
//   const SQL = `SELECT * FROM locations WHERE candidate_name=$1;`;
//   const values = [politician.candidate_name];

//   return client
//     .query(SQL, values)
//     .then(result => {
//       if (result.rowCount > 0) {
//         politician.cacheHit(result);
//       } else {
//         politician.cacheMiss();
//       }
//     })
//     .catch(console.error);
// };

Politician.prototype = {
  save: function() {
    const SQL = `INSERT INTO politician (created_at, candidate_id, candidate_name, party, size0, size200, size500, size1k, size2k) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING RETURNING id;`;
    const values = [this.created_at, this.candidate_id, this.candidate_name, this.party, this.size0, this.size200, this.size500, this.size1k, this.size2k];

    return client.query(SQL, values).then(result => {
      this.id = result.rows[0].id;
      return this;
    });
  }
};

function getPolitician(request, response) {
  const candidate_name = `Bernie Sanders`;

  let candidateUrl = `https://api.open.fec.gov/v1/candidates/search/?office=P&page=1&sort=name&sort_hide_null=false&per_page=20&sort_null_only=false&api_key=KmJ4gTUeGUgZZeUrj9Hdr2GIgRZMqQzz4NALZXvD&name=${candidate_name}&sort_nulls_last=false`;

  return superagent
    .get(candidateUrl)
    .then(candidateResult => {
      superagent.get(`https://api.open.fec.gov/v1/schedules/schedule_a/by_size/by_candidate/?sort_nulls_last=false&page=1&sort_null_only=false&sort_hide_null=false&per_page=20&api_key=${process.env.FEC_KEY}&cycle=2020&candidate_id=${candidateResult.body.results[0].candidate_id}&election_full=false`).then(financialResult => {
        const result = { candidate: candidateResult.body.results[0], financials: financialResult.body.results };
        const politician = new Politician(result);
        politician.save().then(politician => response.send(politician));
      });
    })
    .catch(error => handleError(error));
}
