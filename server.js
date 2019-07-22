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
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.static('public'));

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
function Politician(query, res) {
  this.tableName = 'politicians';
  this.created_at = Date.now();
  this.candidate_id = res.model.results.candidate_id;
  this.candidate_name = res.model.results.candidate_name;
  this.party = res.model.results.party;
  this.size0 = res.model.results.size0;
  this.size200 = res.model.results.size0;
  this.size500 = res.model.results.size0;
  this.size1k = res.model.results.size0;
  this.size2k = res.model.results.size0;
  this.total_disbursements = res.model.results.total_disbursements;
  this.total_receipts = res.model.results.total_receipts;
}

// id SERIAL PRIMARY KEY,
//   created_at BIGINT,
//   candidate_id VARCHAR(255),
//   -- candidate_id: "P00011569"
//   candidate_name VARCHAR(255),
//   -- name: "753, JO",
//   party VARCHAR(255),
//   -- party: null,
//   size0 INTEGER,
//   -- results[0].total
//   size200 BIGINT,
//   -- results[1].total
//   size500 BIGINT,
//   -- results[2].total
//   size1k BIGINT,
//   -- results[3].total
//   size2k BIGINT
//   -- results[4].total

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

// Politician.prototype = {
//   save: function() {
//     const SQL = `INSERT INTO politicians (created_at, candidate_id, candidate_name, total_disbursements, total_receipts) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id;`;
//     const values = [this.created_at, this.candidate_id, this.candidate_name, this.total_disbursements, this.total_receipts];

//     return client.query(SQL, values).then(result => {
//       this.id = result.rows[0].id;
//       return this;
//     });
//   }
// };

function getPolitician(request, response) {
  const candidate_name = `Bernie Sanders`;

  let candidateUrl = `https://api.open.fec.gov/v1/candidates/search/?office=P&page=1&sort=name&sort_hide_null=false&per_page=20&sort_null_only=false&api_key=${process.env.FEC_KEY}&name=${candidate_name}&sort_nulls_last=false`;

  return superagent
    .get(candidateUrl)
    .then(candidateResult => {
      // const politician = new Politician(this.query, result);
      // politician.save().then(politician => response.send(politician));

      superagent.get(`https://api.open.fec.gov/v1/schedules/schedule_a/by_size/by_candidate/?sort_nulls_last=false&page=1&sort_null_only=false&sort_hide_null=false&per_page=20&api_key=${process.env.FEC_KEY}&cycle=2020&candidate_id=${candidateResult.body.results[0].candidate_id}&election_full=false`).then(financialResult => {
        const result = { candidate: candidateResult.text, financials: financialResult.text };
        console.log('result: ', result);
      });
    })
    .catch(error => handleError(error));
}
