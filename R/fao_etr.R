fao_etr = function(RH, Temp_C, Rs, P, U){
  ########################################
  ####### Reference ET  from FAO #########
  ########################################
  #
  # Definitions:
  # Rh = Relative Humidity (%)
  # Temp_C = Temperature (C)
  # Rs = Shortwave Radiation (w m-2)
  # P = Atmospheric Pressure (kPa)
  # U = Wind Speed at 2 m height (m -2)
  # more infomration at:
  # http://www.fao.org/3/X0490E/x0490e08.htm#chapter%204%20%20%20determination%20of%20eto
  # saturation vapour pressure (es)
  es = 0.6108*exp((17.27*Temp_C)/(Temp_C + 237.3))
  # actual vapor pressure (ea)
  ea = es*(RH/100)
  # Compute Net Radiation
  # First Net longwave radiation (Rnl) - Computed used Stefan Boltzmann concept (FAO Eq. 39)
  # no need to compute relative Rs because we are measuring Rs (!!! CHECK !!!)
  # Rs needs to be converted to MJ m-2 hr-1 from W/m2
  Rs_MJ = Rs * 3600 * 1e-6
  # 1 W/m2 = 1 J/m2 s -> 1 J/m2 s x 3600s/1hr = 3600 J/m2 hr * 1e-6 (convert to MJ)
  # Stefan Boltzmann = 5.6703*10^-8 W m-2 K-4 -> 2.041308e-10 MJ m-2 K-4 hr-1
  Rnl = 2.041308e-10 * ((Temp_C+273.16)^4)*(0.34-(0.14*(sqrt(ea))))*((1.35*(Rs_MJ))-1.35)
  # incoming net shortwave radiation (Rns) assuming grass albedo (0.23)
  Rns =  (1 - 0.23) * Rs_MJ 
  # Compute Rn (difference between Rns and Rnl)
  Rn = Rns - Rnl
  # Slope of saturation vapour pressure curve (Eq. 13)
  D = (4098 * (0.6108*exp((17.27*Temp_C)/(Temp_C + 237.3)))) / ((Temp_C + 237.3)^2)
  # g psychrometric constant [kPa °C-1]. (Eq. 8)
  # P is the atmospheric pressure [kPa]
  g = 0.000665 * P
  #Soil heat flux (G) Eq. 45 & 46
  if(Rs_MJ > 0){
    G = 0.1 * Rn
  } else {
    G = 0.5 * Rn
  }
  # compute etr using Eq. 53
  etr = ((0.408*D*(Rn - G)) + (g*(37/(Temp_C + 273))) * (U * (es - ea)))/
    (D + g*(1+0.34*U))
  #return the result
  return(etr)
}