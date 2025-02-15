import { City, CitySolarData, DetailCitySolarData } from "@/app/types/global";
import * as cheerio from "cheerio";

export async function scrapeCitySolarData(
  city: City,
  startDate: string,
  duration: number,
  detailed: boolean = false
): Promise<CitySolarData | DetailCitySolarData> {
  const url = `https://aa.usno.navy.mil/calculated/mrst?body=10&date=${startDate}&reps=${duration}&lat=${city.lat}&lon=${city.lon}&label=${city.name}&tz=9&tz_sign=1&height=0&submit=Get+Data`;
  const res = await fetch(url);
  const data = await res.text();

  const $ = cheerio.load(data);
  const preText = $("pre").text();
  const lines = preText.split("\n");
  const relevantLines = lines
    .slice(17, -1)
    .filter((line) => line.trim() !== "");

  const result = {
    city: city,
    data: [],
  } as CitySolarData | DetailCitySolarData;

  const processData = detailed ? processDetailData : processListData;
  await Promise.all(
    relevantLines.map((line) => processData(line, city, result))
  );

  return result;
}

async function processDetailData(
  line: string,
  city: City,
  result: CitySolarData | DetailCitySolarData
) {
  const columns = line.trim().split(/\s+/);
  if (columns.length === 12) {
    const columnDate = new Date(`${columns[2]}-${columns[1]}-${columns[0]}`);
    const astronomical = await getAstronomicalTwilight(
      city,
      columnDate.getFullYear(),
      columnDate.getMonth(),
      columnDate.getDate()
    );
    result.data.push({
      date: `${columns[2]} ${columns[1]} ${columns[0]}`,
      sunrise: columns[5],
      sunset: columns[9],
      beginTwilight: astronomical.begin,
      endTwilight: astronomical.end,
      riseAzimuth: columns[6],
      setAzimuth: columns[10],
      transit: columns[7],
      transitAzimuth: columns[8],
    });
  }
}

function processListData(line: string, city: City, result: CitySolarData) {
  const columns = line.trim().split(/\s+/);
  if (columns.length === 12) {
    result.data.push({
      date: `${columns[0]}-${columns[1]}-${columns[2]}`,
      sunrise: columns[5],
      sunset: columns[9],
    });
  }
}

export async function getAstronomicalTwilight(
  city: City,
  year: number,
  month: number,
  day: number
) {
  const url = `https://aa.usno.navy.mil/calculated/rstt/year?ID=AA&year=${year}&task=4&lat=${city.lat}&lon=${city.lon}&label=${city.name}&tz=9&tz_sign=1&submit=Get+Data`;
  const res = await fetch(url);
  const data = await res.text();
  const $ = cheerio.load(data);
  const preText = $("pre").text();
  const lines = preText
    .split("\n")
    .slice(6, -2)
    .filter((line) => line.trim() !== "");
  return getDayTime(lines, day, month);
}

function getDayTime(data: string[], day: number, month: number) {
  const dayRow = data[day + 2];
  const dayData = dayRow.split(/\s+/).filter(Boolean);
  const beginIndex = month * 2 + 1;
  const endIndex = beginIndex + 1;

  const begin = dayData[beginIndex];
  const end = dayData[endIndex];

  const formattedBegin = `${begin.slice(0, 2)}:${begin.slice(2)}`;
  const formattedEnd = `${end.slice(0, 2)}:${end.slice(2)}`;

  return { begin: formattedBegin, end: formattedEnd };
}
