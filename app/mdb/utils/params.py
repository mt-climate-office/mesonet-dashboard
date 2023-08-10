import datetime as dt
from dataclasses import dataclass

import dateutil.relativedelta as rd


@dataclass
class params:
    # API_URL = "http://apiv2/"
    API_URL = "https://fcfc-mesonet-staging.cfc.umt.edu/api/v2/"

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

    elem_map = {
        "Precipitation": ["ppt"],
        "ET": ["rh", "bp", "sol_rad", "air_temp", "wind_spd"],
        "Soil VWC": ["soil_vwc"],
        "Air Temperature": ["air_temp"],
        "Solar Radiation": ["sol_rad"],
        "Soil Temperature": ["soil_temp"],
        "Relative Humidity": ["rh"],
        "Wind Speed": ["wind_spd"],
        "Atmospheric Pressure": ["bp"],
    }

    description_to_element = {
        "Air Temperature @ 2 m": "air_temp_0200",
        "Air Temperature @ 8 ft": "air_temp_0244",
        "Atmospheric Pressure": "bp",
        "Precipitation": "ppt",
        "Max Precip Rate": "ppt_max_rate",
        "Relative Humidity": "rh",
        "Snow Depth": "snow_depth",
        "Bulk EC @ -5 cm": "soil_ec_blk_0005",
        "Bulk EC @ -10 cm": "soil_ec_blk_0010",
        "Bulk EC @ -20 cm": "soil_ec_blk_0020",
        "Bulk EC @ -50 cm": "soil_ec_blk_0050",
        "Bulk EC @ -91 cm": "soil_ec_blk_0091",
        "Bulk EC @ -100 cm": "soil_ec_blk_0100",
        "Soil Temperature @ -5 cm": "soil_temp_0005",
        "Soil Temperature @ -10 cm": "soil_temp_0010",
        "Soil Temperature @ -20 cm": "soil_temp_0020",
        "Soil Temperature @ -50 cm": "soil_temp_0050",
        "Soil Temperature @ -91 cm": "soil_temp_0091",
        "Soil Temperature @ -100 cm": "soil_temp_0100",
        "Soil VWC @ -5 cm": "soil_vwc_0005",
        "Soil VWC @ -10 cm": "soil_vwc_0010",
        "Soil VWC @ -20 cm": "soil_vwc_0020",
        "Soil VWC @ -50 cm": "soil_vwc_0050",
        "Soil VWC @ -91 cm": "soil_vwc_0091",
        "Soil VWC @ -100 cm": "soil_vwc_0100",
        "Solar Radiation": "sol_rad",
        "VPD": "vpd_atmo",
        "Well EC": "well_eco",
        "Well Water Level": "well_lvl",
        "Well Water Temperature": "well_tmp",
        "Wind Direction @ 8 ft": "wind_dir_0244",
        "Wind Direction @ 10 m": "wind_dir_1000",
        "Gust Speed @ 8 ft": "windgust_0244",
        "Gust Speed @ 10 m": "windgust_1000",
        "Wind Speed @ 8 ft": "wind_spd_0244",
        "Wind Speed @ 10 m": "wind_spd_1000",
    }

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
        "Gust Speed @ 8 ft [mi/hr]",
        "Gust Speed @ 10 m [mi/hr]",
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
        "Gust Speed @ 8 ft [mi/hr]": "Wind Gust [mi/hr]",
        "Gust Speed @ 10 m [mi/hr]": "Wind Gust [mi/hr]",
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
