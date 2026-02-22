const date = "202302";
const time_period = "m";

const nbuUrl = new URL("https://bank.gov.ua/NBUStatService/v1/statdirectory/inflation");

nbuUrl.searchParams.set("period", time_period);
nbuUrl.searchParams.set("date", date);
nbuUrl.hash = "json";

console.log(nbuUrl.toString());
