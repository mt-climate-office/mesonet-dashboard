import datetime as dt
import os
from dataclasses import dataclass

import dateutil.relativedelta as rd
import pandas as pd

on_server = os.getenv("ON_SERVER")


@dataclass
class Params:
    API_URL = "https://mesonet.climate.umt.edu/api/"

    dist_swap = {
        "-10 cm": "4 in",
        "-100 cm": "40 in",
        "-20 cm": "8 in",
        "-5 cm": "2 in",
        "-50 cm": "20 in",
        "-91 cm": "36 in",
        "10 m": "33 ft",
        "2 m": "6.6 ft",
    }

    color_mapper = {
        "Air Temperature": "#c42217",
        "Solar Radiation": "#c15366",
        "Relative Humidity": "#a16a5c",
        "Snow Depth": "#A020F0",
        "Wind Speed": "#ec6607",
        "Atmospheric Pressure": "#A020F0",
        "Well Water Level": "#0000FF",
        "Well Water Temperature": "#c42217",
        "Well EC": "#AEF359",
        "Gust Speed": "#FEC20C",
        "Max Precip Rate": "#000080",
        "VPD": "#32612D",
        "Wind Direction": "#607D3B",
        "Soil Temperature": None,
        "Soil VWC": None,
        "Bulk EC": None,
        "Precipitation": None,
    }

    endpoints = {
        "hourly": "observations/hourly",
        "daily": "observations/daily",
        "monthly": "observations/daily",
        "raw": "observations",
    }

    derived_endpoints = {
        "hourly": "derived/hourly",
        "daily": "derived/daily",
        "monthly": "derived/daily",
        "raw": "derived/hourly",
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

    satellite_var_mapper = {
        "sm_surface": "Surface Soil Moisture",
        "sm_surface_wetness": "Surface Soil Saturation",
        "sm_rootzone": "Rootzone Soil Moisture",
        "sm_rootzone_wetness": "Rootzone Soil Saturation",
        "GPP": "Gross Primary Production",
        "ET": "Evapotranspiration",
        "PET": "Potential Evapotranspiration",
        "Fpar": "FPAR",
    }

    satellite_product_map = {
        "MYD17A2H.061": "MODIS Aqua",
        "MOD15A2H.061": "MODIS Terra",
        "MOD13A1.061": "MODIS Terra",
        "SPL4CMDL.006": "SMAP Level-4 Carbon",
        "MYD16A2.061": "MODIS Aqua",
        "MOD16A2.061": "MODIS Terra",
        "MYD13A1.061": "MODIS Aqua",
        "MOD17A2H.061": "MODIS Terra",
        "MYD15A2H.061": "MODIS Aqua",
        "SPL4SMGP.006": "SMAP Level-4 Soil Moisture",
        "VNP13A1.001": "VIIRS",
    }

    sat_axis_mapper = {
        "sm_surface": "Surface Soil<br>VWC (%)",
        "sm_surface_wetness": "Surface<br>Soil Saturation",
        "sm_rootzone": "Rootzone Soil<br>VWC (%)",
        "sm_rootzone_wetness": "Rootzone<br>Soil Saturation",
        "GPP": "GPP<br>(g C m^-2)",
        "ET": "ET<br>(mm day^-1)",
        "PET": "PET<br>(mm day^-1)",
        "Fpar": "FPAR",
        "NDVI": "NDVI",
        "EVI": "EVI",
        "LAI": "LAI",
    }

    sat_color_mapper = {
        "MODIS Aqua": "#1f78b4",
        "MODIS Terra": "#33a02c",
        "SMAP Level-4 Carbon": "#e31a1c",
        "SMAP Level-4 Soil Moisture": "#ff7f00",
        "VIIRS": "#b15928",
    }

    sat_compare_mapper = {
        "ET (MODIS Aqua)": "ET-MYD16A2.061",
        "ET (MODIS Terra)": "ET-MOD16A2.061",
        "PET (MODIS Aqua)": "PET-MYD16A2.061",
        "PET (MODIS Terra)": "PET-MOD16A2.061",
        "GPP (MODIS Aqua)": "GPP-MYD17A2H.061",
        "GPP (MODIS Terra)": "GPP-MOD17A2H.061",
        "GPP (SMAP L4C)": "GPP-SPL4CMDL.006",
        "FPAR (MODIS Aqua)": "Fpar-MYD15A2H.061",
        "FPAR (MODIS Terra)": "Fpar-MOD15A2H.061",
        "NDVI (MODIS Aqua)": "NDVI-MYD13A1.061",
        "NDVI (MODIS Terra)": "NDVI-MOD13A1.061",
        "NDVI (VIIRS)": "NDVI-VNP13A1.001",
        "EVI (MODIS Aqua)": "EVI-MYD13A1.061",
        "EVI (MODIS Terra)": "EVI-MOD13A1.061",
        "EVI (VIIRS)": "EVI-VNP13A1.001",
        "LAI (MODIS Aqua)": "LAI-MYD15A2H.061",
        "LAI (MODIS Terra)": "LAI-MOD15A2H.061",
        "Surface VWC (SMAP L4SM)": "sm_surface-SPL4SMGP.006",
        "Surface Sat. (SMAP L4SM)": "sm_surface_wetness-SPL4SMGP.006",
        "Rootzone VWC (SMAP L4SM)": "sm_rootzone-SPL4SMGP.006",
        "Rootzone Sat. (SMAP L4SM)": "sm_rootzone_wetness-SPL4SMGP.006",
    }
