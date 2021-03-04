const path = require("path");
const fs = require("fs");
var url = require("url");
const fetch = require("node-fetch");
const csv = require("fast-csv");


const OUTPUT_DIR = "./ProcessedFiles";

const SERVICE_URI =
  "http://geo-locate.org/webservices/geolocatesvcv2/glcwrap.aspx";

const ENABLE_SNAP_TO_WATERBODIES = false;
const ENABLE_POLY = false;
const ENABLE_UNCERTAINITY = true;
const FORMAT = "json"; // geojson
const ENABLE_HIGHWAY = true;




/**
 * Default values for the query
 */
const queryDefaults = {
  hwyX: ENABLE_HIGHWAY,
  enableH2O: ENABLE_SNAP_TO_WATERBODIES,
  doPoly: ENABLE_POLY,
  format: FORMAT,
};

const headerOptions = {
  "User-Agent": "USFWI/NodeJS",
  "Accept-Encoding": "gzip, deflate",
  Accept: "application/json",
};


/**
 * Returns the Query URL for each record object
 * @param {*} param0 record object
 */
const getQueryUri = ({ locality, country = "", state = "", county = "" }) => {
  const queryParams = new url.URLSearchParams({
    ...queryDefaults,
    locality: encodeURIComponent(locality),
    country,
    state,
    county,
  }).toString();
  return `${SERVICE_URI}?${queryParams}`;
};



/**
 * Parses CSV File into a JS object
 * @param {string} filePath Path to the file
 */
const ParseFile = async (filePath) => {
  const records = [];
  const parser = fs
    .createReadStream(path.resolve(__dirname, filePath))
    .pipe(csv.parse({ headers: true }));

  for await (const record of parser) {
    records.push(record);
  }
  return records;
};

/**
 * Writes records as a CSV to the output directory
 * @param {string} fileName 
 * @param {Object} records 
 */
const WriteToCSV = async(fileName = "Processed", records) =>{
    const filePath = path.resolve(__dirname,OUTPUT_DIR,`${fileName}.csv`);
    csv
      .writeToPath(filePath, records, { headers: true, writeBOM:true })
      .on("error", (err) => console.error(err))
      .on("finish", () => console.log(`Done writing file ${fileName}`));
    return;
}

/**
 * Returns the best matched geo location for a record
 * @param {*} record 
 */
const getLocationData = async (record) => {
  const queryUri = getQueryUri(record);
  const queryResults = await fetch(queryUri, headerOptions)
    .catch((err) => console.error(`Error fetching Data ${err}`))
    .then((res) => res.json())
    .catch((err) => console.error(`Error serilizing Data ${err}`));
    if (queryResults.numResults < 0 || !queryResults.resultSet) {
      return {
        latitude: "",
        longitude: "",
        score: "",
        multiple_results: "",
        precision: ``,
        uncertainty: "",
        debug: "No Results found",
      };
    }

      const locationResults = queryResults.resultSet.features // results are in the features object under resultSet
        .filter((x) => x.geometry.type === "Point") // Get only point locations
        .map((x) => { // convert to a manageable object with only required params
          return {
            latitude: x.geometry.coordinates[0],
            longitude: x.geometry.coordinates[1],
            score: x.properties.score,
            multiple_results: queryResults.numResults > 1,
            precision: `${x.properties.precision} (${x.properties.score})`,
            uncertainty: x.properties.uncertaintyRadiusMeters,
            debug: x.properties.debug,
          };
        });
  // Choose the result with the max score as the best match
  const bestLocationMatch = locationResults.reduce(
    (best, current) => {
      return best.score > current.score ? best : current;
    },
    {
      score: Math.min,
    }
  );

  return bestLocationMatch;
};






/**
 * Main Function
 */

(async () => {

  // Read File paths from Command line args
  var filePaths = process.argv.slice(2);
  if (filePaths.length <= 0) {
    filePaths.push("./sample.csv"); // Sample CSV is default
  }
console.time("All files");
  for (let filePath of filePaths) {
    console.time(`${path.parse(filePath).name}`);
    console.log(`Parsing file ${filePath}`);
    const records = await ParseFile(filePath);
    console.log(`Found ${records.length} records. Fetching Locations`);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try{
      const {
        latitude,
        longitude,
        precision,
        multiple_results,
        uncertainty,
        debug
      } = await getLocationData(record);

      records[i] = {
        // Add location data to the record
        ...record,
        latitude,
        longitude,
        precision,
        multiple_results,
        uncertainty,
        debug,
      };
    }catch (e){
      console.error(`Error fetching geolocation for ${record}`,e);
    }
    }

    // Write to csv
    await WriteToCSV(path.parse(filePath).name,records);
    console.timeEnd(`${path.parse(filePath).name}`);
  }
  console.timeEnd("All files");
})();
