import datetime as dt
import os
from dataclasses import dataclass

import dateutil.relativedelta as rd
import pandas as pd

on_server = os.getenv("ON_SERVER")

if on_server is None or not on_server:
    elements_df = pd.read_csv(
        "https://mesonet.climate.umt.edu/api/v2/elements?type=csv"
    )
    API_URL = "https://mesonet.climate.umt.edu/api/v2/"

else:
    elements_df = pd.read_csv(
        "https://mesonet.climate.umt.edu/api/v2/elements?type=csv"
    )
    API_URL = "https://mesonet.climate.umt.edu/api/v2/"


@dataclass
class params:
    API_URL = API_URL

    START = dt.datetime.now() - rd.relativedelta(weeks=2)

    default_vars = [
        "Precipitation",
        "Reference ET",
        "Soil VWC",
        "Air Temperature",
        "Solar Radiation",
        "Soil Temperature",
        "Relative Humidity",
        "Wind Speed",
        "Atmospheric Pressure",
    ]

    selected_vars = [
        "Precipitation",
        "Reference ET",
        "Soil VWC",
        "Soil Temperature",
        "Air Temperature",
    ]

    description_to_element = dict(
        zip(elements_df["description_short"], elements_df["element"])
    )

    elements = elements_df["element"].tolist()
    elements.append("etr")

    elem_labs = [
        "Air Temperature @ 2 m [°F]",
        "Air Temperature @ 8 ft [°F]",
        "Atmospheric Pressure [mbar]",
        "Precipitation [in]",
        "Max Precip Rate [in/hr]",
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
        "Bulk EC @ -10 cm [mS/cm]",
        "Bulk EC @ -100 cm [mS/cm]",
        "Bulk EC @ -20 cm [mS/cm]",
        "Bulk EC @ -5 cm [mS/cm]",
        "Bulk EC @ -50 cm [mS/cm]",
        "Bulk EC @ -91 cm [mS/cm]",
        "Snow Depth [in.]",
        "Solar Radiation [W/m²]",
        "Wind Direction @ 10 m [deg]",
        "Wind Direction @ 8 ft [deg]",
        "Wind Speed @ 10 m [mi/hr]",
        "Wind Speed @ 8 ft [mi/hr]",
        "Gust Speed @ 8 ft [mi/hr]",
        "Gust Speed @ 10 m [mi/hr]",
        "Well Water Level [in]",
        "Reference ET (a=0.23) [in]",
        "Comprehensive Climate Index [°F]",
        "Feels Like Temperature [°F]",
    ]

    agg_funcs = {
        item: "sum"
        if item in ["Precipitation [in]", "Reference ET (a=0.23) [in]"]
        else "mean"
        for item in elem_labs
    }

    lab_swap = {
        "index": "datetime",
        "Air Temperature @ 2 m [°F]": "Air Temperature [°F]",
        "Air Temperature @ 8 ft [°F]": "Air Temperature [°F]",
        "Soil Temperature @ -10 cm [°F]": "Soil Temperature @ 4 in [°F]",
        "Soil Temperature @ -70 cm [°F]": "Soil Temperature @ 28 in [°F]",
        "Soil Temperature @ -100 cm [°F]": "Soil Temperature @ 40 in [°F]",
        "Soil Temperature @ -20 cm [°F]": "Soil Temperature @ 8 in [°F]",
        "Soil Temperature @ -5 cm [°F]": "Soil Temperature @ 2 in [°F]",
        "Soil Temperature @ -50 cm [°F]": "Soil Temperature @ 20 in [°F]",
        "Soil Temperature @ -91 cm [°F]": "Soil Temperature @ 36 in [°F]",
        "Soil VWC @ -10 cm [%]": "Soil VWC @ 4 in [%]",
        "Soil VWC @ -70 cm [%]": "Soil VWC @ 28 in [%]",
        "Soil VWC @ -100 cm [%]": "Soil VWC @ 40 in [%]",
        "Soil VWC @ -20 cm [%]": "Soil VWC @ 8 in [%]",
        "Soil VWC @ -5 cm [%]": "Soil VWC @ 2 in [%]",
        "Soil VWC @ -50 cm [%]": "Soil VWC @ 20 in [%]",
        "Soil VWC @ -91 cm [%]": "Soil VWC @ 36 in [%]",
        "Soil VWC @ -10 cm Clipped?": "Soil VWC @ 4 in Clipped?",
        "Soil VWC @ -70 cm Clipped?": "Soil VWC @ 28 in Clipped?",
        "Soil VWC @ -100 cm Clipped?": "Soil VWC @ 40 in Clipped?",
        "Soil VWC @ -20 cm Clipped?": "Soil VWC @ 8 in Clipped?",
        "Soil VWC @ -5 cm Clipped?": "Soil VWC @ 2 in Clipped?",
        "Soil VWC @ -50 cm Clipped?": "Soil VWC @ 20 in Clipped?",
        "Soil VWC @ -91 cm Clipped?": "Soil VWC @ 36 in Clipped?",
        "Soil Water Potential @ -10 cm [bar]": "Soil Water Potential @ 4 in [bar]",
        "Soil Water Potential @ -70 cm [bar]": "Soil Water Potential @ 28 in [bar]",
        "Soil Water Potential @ -100 cm [bar]": "Soil Water Potential @ 40 in [bar]",
        "Soil Water Potential @ -20 cm [bar]": "Soil Water Potential @ 8 in [bar]",
        "Soil Water Potential @ -5 cm [bar]": "Soil Water Potential @ 2 in [bar]",
        "Soil Water Potential @ -50 cm [bar]": "Soil Water Potential @ 20 in [bar]",
        "Soil Water Potential @ -91 cm [bar]": "Soil Water Potential @ 36 in [bar]",
        "Percent Saturation @ -10 cm [%]": "Percent Saturation @ 4 in [%]",
        "Percent Saturation @ -70 cm [%]": "Percent Saturation @ 28 in [%]",
        "Percent Saturation @ -100 cm [%]": "Percent Saturation @ 40 in [%]",
        "Percent Saturation @ -20 cm [%]": "Percent Saturation @ 8 in [%]",
        "Percent Saturation @ -5 cm [%]": "Percent Saturation @ 2 in [%]",
        "Percent Saturation @ -50 cm [%]": "Percent Saturation @ 20 in [%]",
        "Percent Saturation @ -91 cm [%]": "Percent Saturation @ 36 in [%]",
        "Bulk EC @ -10 cm [mS/cm]": "Bulk EC @ 4 in [mS/cm]",
        "Bulk EC @ -70 cm [mS/cm]": "Bulk EC @ 28 in [mS/cm]",
        "Bulk EC @ -100 cm [mS/cm]": "Bulk EC @ 40 in [mS/cm]",
        "Bulk EC @ -20 cm [mS/cm]": "Bulk EC @ 8 in [mS/cm]",
        "Bulk EC @ -5 cm [mS/cm]": "Bulk EC @ 2 in [mS/cm]",
        "Bulk EC @ -50 cm [mS/cm]": "Bulk EC @ 20 in [mS/cm]",
        "Bulk EC @ -91 cm [mS/cm]": "Bulk EC @ 36 in [mS/cm]",
        "Wind Direction @ 10 m [deg]": "Wind Direction [deg]",
        "Wind Direction @ 8 ft [deg]": "Wind Direction [deg]",
        "Wind Speed @ 10 m [mi/hr]": "Wind Speed [mi/hr]",
        "Wind Speed @ 8 ft [mi/hr]": "Wind Speed [mi/hr]",
        "Gust Speed @ 8 ft [mi/hr]": "Gust Speed [mi/hr]",
        "Gust Speed @ 10 m [mi/hr]": "Gust Speed [mi/hr]",
    }

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

    elem_map = {
        "Precipitation": ["ppt"],
        "Reference ET": ["etr"],
        "Soil VWC": ["soil_vwc"],
        "Air Temperature": ["air_temp"],
        "Solar Radiation": ["sol_rad"],
        "Soil Temperature": ["soil_temp"],
        "Relative Humidity": ["rh"],
        "Wind Speed": ["wind_spd", "wind_dir"],
        "Atmospheric Pressure": ["bp"],
        "Bulk EC": ["soil_ec_blk"],
        "Gust Speed": ["windgust"],
        "Well EC": ["well_eco"],
        "Well Water Level": ["well_lvl"],
        "Well Water Temperature": ["well_tmp"],
        "VPD": ["vpd_atmo"],
        "Snow Depth": ["snow_depth"],
        "Max Precip Rate": ["ppt_max_rate"],
        "Wind Direction": ["wind_dir"],
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

    axis_mapper = {
        "Precipitation": "Precipitation<br>(inches)",
        "Soil VWC": "Soil VWC.<br>(%)",
        "Bulk EC": "Soil Bulk<br>EC (mS cm<sup>-1</sup>)",
        "Air Temperature": "Air Temp.<br>(°F)",
        "Relative Humidity": "Relative Hum.<br>(%)",
        "Solar Radiation": "Solar Rad.<br>(W/m<sup>2</sup>)",
        "Wind Speed": "Wind Spd.<br>(mph)",
        "Soil Temperature": "Soil Temp.<br>(°F)",
        "Atmospheric Pressure": "Atmos. Pres. (mbar)",
        "Reference ET": "Reference ET<br>(inches)",
        "Snow Depth": "Snow Depth<br>(in.)",
        "Gust Speed": "Gust Speed<br>(mi/hr)",
        "Max Precip Rate": "Max Precip Rate<br>(in/hr)",
        "VPD": "VPD (mbar)",
        "Well Water Level": "Well Depth<br>(in.)",
        "Well Water Temperature": "Well Temperature<br>(°F)",
        "Well EC": "Well EC<br>(mS cm<sup>-1</sup>)",
        "Wind Direction": "Wind Direction<br>(deg)",
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
