true_start = Sys.time()
library(RCurl) ##
library(dplyr) ##
library(tidyverse) ##
library(plotly)##
library(data.table)##
library(doParallel) ##
library(htmltools)##
library(htmlwidgets)##
library(knitr)##
library(kableExtra)##
library(units)##
library(lubridate) ##

# var set root dir
setwd("/home/zhoylman/")

# var name converstion
name_conversion = read_csv("/home/zhoylman/mesonet-dashboard/data/mesonet_information/name_conversion_mesonet.csv")

lookup = data.frame(name = name_conversion$name,
                    long_name = name_conversion$description)

#get current frame to plot
time = data.frame(current = Sys.time() %>% as.Date()) %>%
  mutate(start = current - 14)

#retrieve the curent station list
stations = getURL("https://cfcmesonet.cfc.umt.edu/api/stations?type=csv&clean=true") %>%
  read_csv()

#retrieve the lastest data (last time signiture)
latest = getURL("https://cfcmesonet.cfc.umt.edu/api/latest?tz=US%2FMountain&wide=false&type=csv")%>%
  read_csv() %>%
  mutate(datetime = datetime %>%
           lubridate::with_tz("America/Denver"),
         units = stringr::str_remove_all(string = units, pattern = 'Â'))%>%
  mutate(value_unit = mixed_units(value, units)) %>%
  plyr::join(.,lookup,by='name') %>%
  select("station_key", "datetime", "name", "value_unit", "units", "long_name") %>%
  rowwise() %>%
  mutate(new_value = 
           if(units == "°C") value_unit %>% set_units("°F")  else
             if(units == "m³/m³") value_unit %>% set_units("%") else
               if(units == "mS/cm") value_unit %>% set_units("mS/in") else
                 if(units == "mm/h") value_unit %>% set_units("in/hr") else
                   if(units == "mm") value_unit %>% set_units("in") else
                     if(units == "%") value_unit %>% set_units("%") else
                       if(units == "W/m²") value_unit %>% set_units("W/m²") else
                         if(units == "kPa") value_unit %>% set_units("bar") else
                           if(units == "°") value_unit %>% set_units("°") else
                             if(units == "m/s") value_unit %>% set_units("mi/hr") else
                               if(units == "mV") value_unit %>% set_units("mV") else NA) %>%
  mutate(new_units = 
           if(units == "°C") "°F"  else
             if(units == "m³/m³") "%" else
               if(units == "mS/cm") "mS/in" else
                 if(units == "mm/h") "in/hr" else
                   if(units == "mm") "in" else
                     if(units == "%") "%" else
                       if(units == "W/m²") "W/m²" else
                         if(units == "kPa") "bars" else
                           if(units == "°") "°" else
                             if(units == "m/s") "mph" else
                               if(units == "mV") "mV" else NA) %>%
  mutate(new_value = round(new_value, 2)) %>%
  mutate(value_unit_new = mixed_units(new_value, new_units))

#rename precip
latest$long_name = stringr::str_replace(latest$long_name, "Net precipitation since previous report", 'Precipitation since previous report')

#manual
simple_plotly = function(data,name_str,col,ylab,conversion_func){
  data %>%
    dplyr::filter(name == name_str) %>%
    mutate(value = conversion_func(value)) %>%
    transform(id = as.integer(factor(name))) %>%
    plot_ly(x = ~datetime, y = ~value, color = ~name, colors = col, showlegend=F, 
            yaxis = ~paste0("y", id)) %>%
    layout(yaxis = list(
      title = paste0(ylab)))%>%
    add_lines()
}

#define inputs (add precip when ready)
names_str = c("sol_radi", "air_temp", "rel_humi", "wind_spd")
col = c('red', 'green', 'black', "orange")
ylab = c("Solar Radiation\n(W/m<sup>2</sup>)", "Air Temperature\n(°F)", "Relative Humidity\n(%)", "Wind Speed\n(mph)")
target_unit = c("W/m²", "°F", "%", "mph")
conversion_func = list(function(x){return(x)}, 
                       function(x){return((x * 9/5)+32)},
                       function(x){return(x)}, 
                       function(x){return(x * 2.237)})

s = 1

url = paste0("https://cfcmesonet.cfc.umt.edu/api/observations?stations=",stations$`Station ID`[s], "&latest=false&start_time=",
             '2020-01-01', "&end_time=", '2020-12-01', "&tz=US%2FMountain&wide=false&type=csv")

location = stations[s,]

#download data
data = getURL(url) %>%
  read_csv() %>%
  mutate(datetime = datetime %>%
           lubridate::with_tz("America/Denver")) %>%
  select(name, value, datetime, units) 

###############################################################
################### reference ET function #####################
###############################################################
#Following https://www.researchgate.net/publication/237412886_Penman-Monteith_hourly_Reference_Evapotranspiration_Equations_for_Estimating_ETos_and_ETrs_with_Hourly_Weather_Data 
library(magrittr)

ref_et_mesonet = function(data){
  #compute the hourly average data
  hourly_data = data %>%
    mutate(day = day(datetime),
           hour = hour(datetime),
           year = year(datetime),
           month = month(datetime)) %>%
    group_by(hour, day, year, month, name) %>%
    summarise(value = mean(value, na.rm = T)) %>%
    mutate(datetime = ISOdate(year, month, day, hour)) %>%
    ungroup() %>%
    select(value, datetime, name) %>%
    arrange(desc(datetime)) %>%
    pivot_wider(names_from = name, values_from = value)
  
  #wind speed
  u2 = hourly_data %>% 
    mutate(u2 = wind_spd * ((4.87/(log((67.8*2)-5.42))))) %>%
    select(u2, datetime) %>%
    arrange(desc(datetime))%$%
    u2
  #compute potential radiation for the site
  #solar constant
  Gsc = 0.082 # MJ m-2 min-1
  #steffan-boltzman
  sigma = 2.04*10^-10
  #latitude in radians
  phi = (pi*location$Latitude)/180
  #julian days
  J = hourly_data %$%
    yday(datetime)
  #correction for eccentricity of Earth’s orbit around the sun
  dr = 1+(0.033*cos(((2*pi)/365)*J))
  #Declination of the sun above the celestial equator in radians
  delta = 0.409*sin((((2*pi)/365)*J)-1.39)
  #station longitude in degrees # positive for west
  Lm = -location$Longitude
  #longitude of the local time meridian
  Lz = 105
  #solar time correction for wobble in Earth’s rotation
  b = (2*pi*(J - 81))/364
  Sc = (0.1645*sin(2*b))-(0.1255*cos(b)) - (0.025*sin(b))
  #hour
  t = hourly_data %>%
    mutate(hour = hour(datetime)) %$%
    hour
  #hour angle in radians
  omega = (pi / 12)*((t - 0.5)+ ((Lz - Lm)/15) - 12 + Sc)
  #hour angle 1⁄2 hour before ω in radians
  omega1 = omega - ((1/2)*(pi / 12))
  #hour angle 1⁄2 hour after ω in radians
  omega2 = omega + ((1/2)*(pi / 12))
  #solar altitude angle in radians
  sin_theta = (omega2 - omega1)*(sin(phi)*sin(delta)) + 
    (cos(phi)*cos(delta))*(sin(omega2) - sin(omega1))
  #extraterrestrial radiation (MJ m -2 h -1 )
  Ra = (12/pi)*(60*Gsc)*dr*sin_theta
  #solar altitude in degrees
  beta = (180/pi)*asin((sin(phi)*sin(delta) + (cos(phi)*cos(delta)*cos(omega))))
  #clear sky total global solar radiation at the Earth’s surface in MJ m -2 h -1
  Rso = Ra*(0.75+((2*10^-5)*(location$`Elevation (feet)`)*0.3048))
  #mean hourly temperature
  air_temp = hourly_data %>% 
    select(air_temp, datetime) %>%
    arrange(desc(datetime)) %$%
    air_temp
  #saturation vapor pressure (kPa) at the mean hourly air temperature (T) in o C
  es = 0.6108*exp((17.27*air_temp)/(air_temp + 237.3))
  #dew point, following https://journals.ametsoc.org/view/journals/bams/86/2/bams-86-2-225.xml
  RH = hourly_data %>% 
    select(rel_humi, datetime) %>%
    arrange(desc(datetime)) %$%
    rel_humi
  Td = air_temp - ((100 - RH)/5)
  #actual vapor pressure or saturation vapor pressure (kPa) at the mean dew point temperature
  ea = 0.6108*exp((17.27 * Td)/(Td + 237.3))
  #apparent ‘net’ clear sky emissivity
  epsilon_prime = 0.34 - 0.14*(sqrt(ea))
  #Measured solar radiation
  Rs = hourly_data %>% 
    mutate(Rs = sol_radi * 0.0036) %>%
    select(Rs, datetime) %>%
    arrange(desc(datetime)) %$%
    Rs
  # a cloudiness function of Rs and Rso (This could use some work....)
  R_ratio = Rs/Rso
  R_ratio[R_ratio > 1 | R_ratio < 0.3] = NA
  R_ratio[beta < 17.2] = 0
  f = 1.35*(R_ratio)-0.35
  #net short wave radiation as a function of measured solar radiation (R s ) in MJ m -2 h -1
  Rns = (1-0.23)*Rs
  #net long wave radiation in MJ m -2 h -1 - Black body equation
  Rnl = f*epsilon_prime*sigma*(air_temp + 273.15)^4
  #R n = net radiation over grass in MJ m -2 h -1
  Rn = Rns + Rnl
  #Calculate ET o using the Penman-Monteith equation as presented by Allen et al.(1994)
  #barometric pressure in kPa
  Bp = hourly_data %>% 
    select(atmos_pr, datetime) %>%
    arrange(desc(datetime)) %$%
    atmos_pr
  #λ = latent heat of vaporization in (MJ kg -1 )
  lambda = 2.45
  #γ = psychrometric constant in kPa o C -1
  gamma = 0.00163*(Bp/lambda)
  #ra r a = aerodynamic resistance in s m -1 is estimated for a 0.12 m tall 
  # crop as a function of wind speed (u 2 ) in m s -1
  ra = 208/u2
  #Modified psychrometric constant ( γ∗ ) FOR 0.5m canopy
  gamma_star = ifelse(Rn > 0, gamma*(1+(30/(118/u2))), gamma*(1+(200/(118/u2))))
  #∆ = slope of the saturation vapor pressure curve (kPa o C -1 ) at mean air temperature (T)
  Delta = (4099*es)/((air_temp + 237.3)^2)
  #G = soil heat flux density (MJ m -2 h -1 )
  G = ifelse(Rn > 0, 0.04*Rn, 0.2*Rn)
  #Ro is the radiation term of the Penman-Monteith and Penman equations in mm d -1 .
  Rr = ifelse(Rn > 0,  
              ((0.408*Delta*(Rn - G))/(Delta + (gamma_star * (1 + (0.25*u2))))), # U2?????????
              ((0.408*Delta*(Rn - G))/(Delta + (gamma_star * (1 + (1.7*u2)))))) # U2?????????
  
  #Ar = aerodynamic term of the Penman-Monteith equation in mm d -1 with u 2 the windspeed at 2 m height
  Ar = ifelse(Rn > 0,  
              ((((66*gamma_star)/(air_temp + 273))*u2*(es - ea))/(Delta+(gamma_star*(1+(0.25*u2))))), # Tm ?????????????????????
              ((((66*gamma_star)/(air_temp + 273))*u2*(es - ea))/(Delta+(gamma_star*(1+(1.7*u2))))))
  
  #Reference evapotranspiration
  ETrs = data.frame(datetime = hourly_data$datetime,
                    Rr = Rr,
                    Ar = Ar,
                    ETrs = Rr + Ar) %>%
    as_tibble()
  return(ETrs)
}

tictoc::tic()
ETrs = ref_et_mesonet(data)
tictoc::toc()
plot(ETrs$datetime, ETrs$ETrs, type = 'l', ylab = 'Reference ET - (mm/hr)', main = location$`Station name`, xlab = '')
