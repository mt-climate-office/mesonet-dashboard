import aiohttp
import time
import io
import pandas as pd
import asyncio


urls = [
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=ppt&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=air_temp_0200&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=soil_vwc_0005&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=soil_vwc_0010&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=soil_vwc_0020&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=soil_vwc_0050&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=soil_temp_0005&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=soil_temp_0010&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=soil_temp_0020&type=csv&wide=False",
    "https://mesonet.climate.umt.edu/api/v2/observations/?stations=aceround&level=1&units=SI&start_time=2022-03-01T00:00:00&elements=soil_temp_0050&type=csv&wide=False",
]


async def process_response(session, url):
    async with session.get(url) as resp:
        with io.StringIO(await resp.text()) as text_io:
            return pd.read_csv(text_io)
        # dat = await resp.text()
        # return dat


async def main():

    async with aiohttp.ClientSession() as session:

        tasks = []
        for url in urls:
            tasks.append(asyncio.ensure_future(process_response(session, url)))

        out = await asyncio.gather(*tasks)
        return out


start_time = time.perf_counter()
asyncio.run(main())
print("--- %s seconds ---" % (time.perf_counter() - start_time))
