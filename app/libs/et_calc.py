import numpy as np
import pandas as pd


def fao_etr_hourly(lat, lon, J, hour, z, RH, Temp_C, Rs, P, U):
    ########################################
    ####### Reference ET  from FAO #########
    ########################################
    #
    # Definitions:
    # lat = latitude [rad]
    # lon = longitude of the measurement site [degrees west of Greenwich]
    # J = Julian Day
    # hour = hour
    # z = elevation (m)
    # Rh = Relative Humidity (%)
    # Temp_C = Temperature (C)
    # Rs = Shortwave Radiation (w m-2)
    # P = Atmospheric Pressure (kPa)
    # U = Wind Speed at 2 m height (m -2)
    # more infomration at:
    # http://www.fao.org/3/X0490E/x0490e08.htm#chapter%204%20%20%20determination%20of%20eto

    # start with solar geometry calculations to compute the max extraterrestrial radiation
    # this will allow us to estimate the degree of "cloudieness"

    # latitude, j, expressed in radians
    j = (np.pi / 180) * lat

    # t = mid point in the hour
    t = hour + 0.5

    # longitude is negative in our database, invert
    lon = abs(lon)

    # inverse relative distance Earth-Sun, dr, and the solar declination, d (delta), are given by
    dr = 1 + 0.033 * np.cos(((2 * np.pi) / 365) * J)
    d = 0.409 * np.sin((((2 * np.pi) / 365) * J) - 1.39)

    # The solar time angle at midpoint of the period is:
    # Lz longitude of the centre of the local time zone
    # Lz = 75, 90, 105 and 120° for the Eastern, Central, Rocky Mountain and Pacific time zones (United States)
    lz = 105

    # The seasonal correction (Sc) for solar time is:
    b = ((2 * np.pi) * (J - 81)) / 364
    Sc = (0.1645 * np.sin(2 * b)) - (0.1255 * np.cos(b)) - (0.025 * np.sin(b))
    w = (np.pi / 12) * (((t + (0.06667 * (lz - lon))) + Sc) - 12)

    # The solar time angles at the beginning and end of the period are given by:
    w1 = w - ((np.pi * 1) / 24)
    w2 = w + ((np.pi * 1) / 24)

    # The sunset hour angle, ws, is given by:
    ws = np.arccos((-np.tan(j) * np.tan(d)))

    # The daylight hours, N, are given by:
    N = (24 / np.pi) * ws

    # Extraterrestrial radiation for hourly or shorter periods (Ra)
    Gsc = 0.0820
    Ra = ((12 * 60) / np.pi) * (
        Gsc
        * dr
        * (
            ((w2 - w1) * np.sin(j) * np.sin(d))
            + (np.cos(j) * np.cos(d) * (np.sin(w2) - np.sin(w1)))
        )
    )

    # Clear-sky solar radiation (Rso)
    Rso = (0.75 + ((2 * 10**-5) * z)) * Ra

    # saturation vapour pressure (es)
    es = 0.6108 * np.exp((17.27 * Temp_C) / (Temp_C + 237.3))
    # actual vapor pressure (ea)
    ea = es * (RH / 100)
    # Compute Net Radiation
    # First Net longwave radiation (Rnl) - Computed used Stefan Boltzmann concept (FAO Eq. 39)
    # no need to compute relative Rs because we are measuring Rs (!!! CHECK !!!)
    # Rs needs to be converted to MJ m-2 hr-1 from W/m2
    Rs_MJ = Rs * 3600 * 1e-6
    # 1 W/m2 = 1 J/m2 s -> 1 J/m2 s x 3600s/1hr = 3600 J/m2 hr * 1e-6 (convert to MJ)
    # Stefan Boltzmann = 5.6703*10^-8 W m-2 K-4 -> 2.041308e-10 MJ m-2 K-4 hr-1
    rel_Rs = Rs_MJ / Rso
    rel_Rs = 1 if rel_Rs.all() > 1 else rel_Rs

    Rnl = (
        2.041308e-10
        * ((Temp_C + 273.16) ** 4)
        * (0.34 - (0.14 * (np.sqrt(ea))))
        * ((1.35 * (rel_Rs)) - 0.35)
    )
    # incoming net shortwave radiation (Rns) assuming grass albedo (0.23)
    Rns = (1 - 0.23) * Rs_MJ
    # Compute Rn (difference between Rns and Rnl)
    Rn = Rns - Rnl
    # Slope of saturation vapour pressure curve (Eq. 13)
    D = (4098 * (0.6108 * np.exp((17.27 * Temp_C) / (Temp_C + 237.3)))) / (
        (Temp_C + 237.3) ** 2
    )
    # g psychrometric constant [kPa °C-1]. (Eq. 8)
    # P is the atmospheric pressure [kPa]
    g = 0.000665 * P
    # Soil heat flux (G) Eq. 45 & 46
    G = 0.1 * Rn if Rs_MJ > 0 else 0.5 * Rn

    # compute etr using Eq. 53
    etr = ((0.408 * D * (Rn - G)) + (g * (37 / (Temp_C + 273))) * (U * (es - ea))) / (
        D + g * (1 + 0.24 * U)
    )

    etr = etr if etr.all() > 0 else 0

    # return the result
    return etr


# Rh = Relative Humidity (%)
# Temp_C = Temperature (C)
# Rs = Shortwave Radiation (w m-2)
# P = Atmospheric Pressure (kPa)
# U = Wind Speed at 2 m height (m -2)
# more infomration at:


def fao_etr_daily(lat, J, z, RH, Temp_C, Rs, P, U):
    ########################################
    ####### Reference ET  from FAO #########
    ########################################
    #
    # Definitions:
    # lat = latitude [rad]
    # J = Julian Day
    # Rh = Relative Humidity (%)
    # Temp_C = Temperature (C)
    # Rs = Shortwave Radiation (w m-2)
    # P = Atmospheric Pressure (kPa)
    # U = Wind Speed at 2 m height (m -2)
    # z = elevation (m)
    # more infomration at:
    # http://www.fao.org/3/X0490E/x0490e08.htm#chapter%204%20%20%20determination%20of%20eto

    # start with solar geometry calculations to compute the max extraterrestrial radiation
    # this will allow us to estimate the degree of "cloudieness"

    # latitude, j, expressed in radians
    j = (np.pi / 180) * lat

    # inverse relative distance Earth-Sun, dr, and the solar declination, d (delta), are given by
    dr = 1 + 0.033 * np.cos(((2 * np.pi) / 365) * J)
    d = 0.409 * np.sin((((2 * np.pi) / 365) * J) - 1.39)

    # The sunset hour angle, ws, is given by:
    ws = np.arccos((-np.tan(j) * np.tan(d)))

    # Extraterrestrial radiation for daily periods (Ra)
    # Gsc solar constant = 0.0820 MJ m-2 min-1
    Gsc = 0.0820
    Ra = ((24 * 60) / np.pi) * (
        Gsc * (ws * np.sin(j) * np.sin(d) + np.cos(j) * np.cos(d) * np.sin(ws))
    )

    # Clear-sky solar radiation (Rso)
    Rso = (0.75 + ((2 * 10**-5) * z)) * Ra

    # saturation vapour pressure (es)
    es = 0.6108 * np.exp((17.27 * Temp_C) / (Temp_C + 237.3))
    # actual vapor pressure (ea)
    ea = es * (RH / 100)
    # Compute Net Radiation
    # First Net longwave radiation (Rnl) - Computed used Stefan Boltzmann concept (FAO Eq. 39)
    # no need to compute relative Rs because we are measuring Rs (!!! CHECK !!!)
    # Rs needs to be converted to MJ m-2 day-1 from W/m2 using 15 minute readings
    Rs_MJ = Rs * 900 * 1e-6
    # 1 W/m2 = 1 J/m2 s -> 1 J/m2 s x 3600s/1hr = 3600 J/m2 hr * 1e-6 (convert to MJ)
    # Stefan Boltzmann = 5.6703*10^-8 W m-2 K-4 -> 4.903e-9 MJ m-2 K-4 d-1
    rel_Rs = Rs_MJ / Rso
    rel_Rs = 1 if rel_Rs.all() > 1 else rel_Rs

    Rnl = (
        4.903e-9
        * ((Temp_C + 273.16) ** 4)
        * (0.34 - (0.14 * (np.sqrt(ea))))
        * ((1.35 * (rel_Rs)) - 0.35)
    )
    # incoming net shortwave radiation (Rns) assuming grass albedo (0.23)
    Rns = (1 - 0.23) * Rs_MJ
    # Compute Rn (difference between Rns and Rnl)
    Rn = Rns - Rnl
    # Slope of saturation vapour pressure curve (Eq. 13)
    D = (4098 * (0.6108 * np.exp((17.27 * Temp_C) / (Temp_C + 237.3)))) / (
        (Temp_C + 237.3) ** 2
    )
    # g psychrometric constant [kPa °C-1]. (Eq. 8)
    # P is the atmospheric pressure [kPa]
    g = 0.000665 * P
    # Soil heat flux ad daily timestep is considered 0 (G)
    G = 0
    # compute etr using Eq. 53
    etr = ((0.408 * D * (Rn - G)) + (g * (900 / (Temp_C + 273))) * (U * (es - ea))) / (
        D + g * (1 + 0.34 * U)
    )

    etr = etr if etr.any() > 0 else 0
    # return the result
    return etr
