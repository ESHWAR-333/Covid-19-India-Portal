const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running on http://localhost:3000/");
    });
  } catch (e) {
    console.log(`db error ${e.message}`);
  }
};

initializeDBAndServer();

const authenticationToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `select * from user where username='${username}'`;
  const result = await db.get(checkUserQuery);
  //   console.log(result);
  if (result === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, result.password);
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
// app.post("/login/", async (request, response) => {
//   const { username, password } = request.body;
//   console.log(username);
//   const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
//   const dbUser = await db.get(selectUserQuery);
//   console.log(dbUser);
//   if (dbUser === undefined) {
//     response.status(400);
//     response.send("Invalid User");
//   } else {
//     const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
//     if (isPasswordMatched === true) {
//       const payload = {
//         username: username,
//       };
//       const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
//       response.send({ jwtToken });
//     } else {
//       response.status(400);
//       response.send("Invalid Password");
//     }
//   }
// });

const convertSankToCamel = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertSankToCamel2 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
//API 1

app.get("/states/", authenticationToken, async (request, response) => {
  const stateQuery = `select * from state`;
  const dbResponse = await db.all(stateQuery);
  response.send(dbResponse.map((each) => convertSankToCamel(each)));
});

//API 2

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const specificStateQuery = `select * from state where state_id=${stateId}`;
  const dbResponse = await db.get(specificStateQuery);
  response.send(convertSankToCamel(dbResponse));
});

//API 3
app.post("/districts/", authenticationToken, async (request, response) => {
  const requestBody = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = requestBody;
  const districtQuery = `insert into district (
    district_name,
    state_id,
    cases,
    cured,
    active,
    deaths )
     values (
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    )`;
  await db.run(districtQuery);
  response.send("District Successfully Added");
});

//API 4
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `select * from district where
    district_id=${districtId}`;
    const dbResponse = await db.get(districtQuery);
    response.send(convertSankToCamel2(dbResponse));
    //   response.send(dbResponse);
  }
);

//API 5
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDeleteQuery = `delete from district where
    district_id=${districtId}`;
    await db.run(districtDeleteQuery);
    response.send("District Removed");
  }
);

//API 6

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const requestBody = request.body;
    const { districtName, stateId, cases, cured, active, deaths } = requestBody;
    const districtUpdateQuery = `update district set
    'district_name'='${districtName}',
    state_id='${stateId}',
    cases='${cases}',
    cured='${cured}',
    active='${active}',
    deaths='${deaths}'
    where
    district_id=${districtId};`;
    await db.run(districtUpdateQuery);
    response.send("District Details Updated");
  }
);

//API 7
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const stateStatsQuery = `
    select 
         sum(cases),
         sum(cured),
         sum(active),
        sum(deaths)
    from 
        district 
    where 
        state_id=${stateId};`;
    const stats = await db.get(stateStatsQuery);
    response.send({
      totalCases: stats["sum(cases)"],
      totalCured: stats["sum(cured)"],
      totalActive: stats["sum(active)"],
      totalDeaths: stats["sum(deaths)"],
    });
    //   response.send(dbResponse);
  }
);

//API 8
app.get(
  "/districts/:districtId/details/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictIdQuery = `
select state_id from district 
where district_id = ${districtId};`;
    const getDistrictIdQueryResponse = await db.get(getDistrictIdQuery);

    const getStateNameQuery = `
select state_name as stateName from state
where state_id = ${getDistrictIdQueryResponse.state_id};
`;
    const getStateNameQueryResponse = await db.get(getStateNameQuery);
    response.send(getStateNameQueryResponse);
  }
);

module.exports = app;
