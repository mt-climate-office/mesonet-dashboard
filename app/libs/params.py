from dataclasses import dataclass
import datetime as dt
import dateutil.relativedelta as rd


@dataclass
class params:

    API_URL = "https://mesonet.climate.umt.edu/api/v2/"

    START = dt.datetime.now() - rd.relativedelta(weeks=2)

    elements = [
        "air_temp_0200",
        "air_temp_0244",
        "bp",
        "ppt",
        "rh",
        "soil_temp_0005",
        "soil_temp_0010",
        "soil_temp_0020",
        "soil_temp_0050",
        "soil_temp_0091",
        "soil_temp_0100",
        "soil_vwc_0005",
        "soil_vwc_0010",
        "soil_vwc_0020",
        "soil_vwc_0050",
        "soil_vwc_0091",
        "soil_vwc_0100",
        "sol_rad",
        "wind_dir_0244",
        "wind_dir_1000",
        "wind_spd_0244",
        "wind_spd_1000",
    ]

    elem_labs = [
        "Air Temperature @ 2 m [°F]",
        "Air Temperature @ 8 ft [°F]",
        "Atmospheric Pressure [mbar]",
        "Precipitation [in]",
        "Relative Humidity [%]",
        "Soil Temperature @ -10 cm [°F]",
        "Soil Temperature @ -100 cm [°F]",
        "Soil Temperature @ -20 cm [°F]",
        "Soil Temperature @ -5 cm [°F]",
        "Soil Temperature @ -50 cm [°F]",
        "Soil Temperature @ -91 cm [°F]",
        "Soil VWC @ -10 cm [%]",
        "Soil VWC @ -100 cm [%]",
        "Soil VWC @ -20 cm [%]",
        "Soil VWC @ -5 cm [%]",
        "Soil VWC @ -50 cm [%]",
        "Soil VWC @ -91 cm [%]",
        "Solar Radiation [W/m²]",
        "Wind Direction @ 10 m [deg]",
        "Wind Direction @ 8 ft [deg]",
        "Wind Speed @ 10 m [mi/hr]",
        "Wind Speed @ 8 ft [mi/hr]",
    ]

    lab_swap = {
        "index": "datetime",
        "Air Temperature @ 2 m [°F]": "Air Temperature [°F]",
        "Air Temperature @ 8 ft [°F]": "Air Temperature [°F]",
        "Soil Temperature @ -10 cm [°F]": "Soil Temperature @ 4 in [°F]",
        "Soil Temperature @ -100 cm [°F]": "Soil Temperature @ 40 in [°F]",
        "Soil Temperature @ -20 cm [°F]": "Soil Temperature @ 8 in [°F]",
        "Soil Temperature @ -5 cm [°F]": "Soil Temperature @ 2 in [°F]",
        "Soil Temperature @ -50 cm [°F]": "Soil Temperature @ 20 in [°F]",
        "Soil Temperature @ -91 cm [°F]": "Soil Temperature @ 36 in [°F]",
        "Soil VWC @ -10 cm [%]": "Soil VWC @ 4 in [%]",
        "Soil VWC @ -100 cm [%]": "Soil VWC @ 40 in [%]",
        "Soil VWC @ -20 cm [%]": "Soil VWC @ 8 in [%]",
        "Soil VWC @ -5 cm [%]": "Soil VWC @ 2 in [%]",
        "Soil VWC @ -50 cm [%]": "Soil VWC @ 20 in [%]",
        "Soil VWC @ -91 cm [%]": "Soil VWC @ 36 in [%]",
        "Wind Direction @ 10 m [deg]": "Wind Direction [deg]",
        "Wind Direction @ 8 ft [deg]": "Wind Direction [deg]",
        "Wind Speed @ 10 m [mi/hr]": "Wind Speed [mi/hr]",
        "Wind Speed @ 8 ft [mi/hr]": "Wind Speed [mi/hr]",
    }

    elem_map = {
        "Air Temperature @ 2 m [°F]",
        "Air Temperature @ 8 ft [°F]",
        "Atmospheric Pressure [mbar]",
        "Precipitation [in]",
        "Relative Humidity [%]",
        "Soil Temperature @ -10 cm [°F]",
        "Soil Temperature @ -100 cm [°F]",
        "Soil Temperature @ -20 cm [°F]",
        "Soil Temperature @ -5 cm [°F]",
        "Soil Temperature @ -50 cm [°F]",
        "Soil Temperature @ -91 cm [°F]",
        "Soil VWC @ -10 cm [%]",
        "Soil VWC @ -100 cm [%]",
        "Soil VWC @ -20 cm [%]",
        "Soil VWC @ -5 cm [%]",
        "Soil VWC @ -50 cm [%]",
        "Soil VWC @ -91 cm [%]",
        "Solar Radiation [W/m²]",
        "Wind Direction @ 10 m [deg]",
        "Wind Direction @ 8 ft [deg]",
        "Wind Speed @ 10 m [mi/hr]",
        "Wind Speed @ 8 ft [mi/hr]",
    }

    color_mapper = {
        "Air Temperature": "#c42217",
        "Solar Radiation": "#c15366",
        "Relative Humidity": "#a16a5c",
        "Wind Speed": "#ec6607",
        "Atmospheric Pressure": "#A020F0",
        "Soil Temperature": None,
        "Soil VWC": None,
        "Precipitation": None,
    }

    axis_mapper = {
        "Precipitation": "Daily<br>Precipitation<br>(in)",
        "Soil VWC": "Soil VWC.<br>(%)",
        "Air Temperature": "Air Temp.<br>(°F)",
        "Relative Humidity": "Relative Hum.<br>(%)",
        "Solar Radiation": "Solar Rad.<br>(W/m<sup>2</sup>)",
        "Wind Speed": "Wind Spd.<br>(mph)",
        "Soil Temperature": "Soil Temp.<br>(°F)",
        "Atmospheric Pressure": "Atmos. Pres. (mbar)",
        "ET": "Reference ET (in/day)",
    }

    short_name_mapper = {
        "Precipitation [in]": ["pr"],
        "Air Temperature [°F]": ["tmmn", "tmmx"],
        "Relative Humidity [%]": ["rmin", "rmax"],
        # "Solar Radiation [W/m²]": ["srad"],
        # "Wind Speed [mi/hr]": ["vs"],
        "ET": ["pet"],
    }

    wind_directions = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ]
