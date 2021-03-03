# Batch processing Files using GeoLocate Web Services

Processing Geo location for a CSV file using the [GeoLocate Webservice JSON Wrapper](http://www.geo-locate.org/files/glcJSON.pdf).

Sample CSV file used for processing can be found [here](./sample.csv)

## Running the script
- Install packages `npm i`
- Process Sample File `node index.js`
- Process specific file(s) `node index.js <file1_path> <file2_path> ...`. The path can be absolute or relative the the current directory

Output files will be in the [ProcessedFiles](./ProcessedFiles) directory with the same file name as the input files.