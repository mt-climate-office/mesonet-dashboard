# MT mesonet dashboard update script.
# This script updates the html widgets that are included on the MT mesonet dashboard
# Widgets include plotly based plots of select variables and a kable table for (latest observations)
# Author: Zach Hoylman - zachary.hoylman@mso.umt.edu 

#import required libraries
library(RCurl) 
library(dplyr) 
library(tidyverse) 
library(plotly)
library(data.table)
library(doParallel)
library(htmltools)
library(htmlwidgets)
library(knitr)
library(kableExtra)
library(units)
library(lubridate)

#set base dir
setwd("/home/zhoylman/")

#source ETr function
source("/home/zhoylman/mesonet-dashboard/R/fao_etr.R")

#var name converstion
name_conversion = read_csv("/home/zhoylman/mesonet-dashboard/data/mesonet_information/name_conversion_mesonet.csv")

#generate simple look up table for conversions
lookup = data.frame(name = name_conversion$name,
                    long_name = name_conversion$description)

#get current frame to plot
time = data.frame(current = Sys.time() %>% as.Date()) %>%
  mutate(start = current - 14)

#retrieve the curent station list
stations = getURL("https://mesonet.climate.umt.edu/api/stations?type=csv&clean=true") %>%
  read_csv()

#retrieve the lastest data (last time signiture)
latest = getURL("https://mesonet.climate.umt.edu/api/latest?wide=false&type=csv")%>%
  read_csv() %>%
  mutate(datetime = datetime %>%
           lubridate::with_tz("America/Denver"),
           units = stringr::str_remove_all(string = units, pattern = 'Â'))%>%
  filter(units != 'RH') %>%
  mutate(value_unit = mixed_units(value, units)) %>%
  left_join(.,lookup,by='name') %>%
  select("station_key", "datetime", "name", "value_unit", "units", "long_name") %>%
  rowwise() %>%
  #convert units using the units package
  mutate(new_value = 
          list(if(units == "°C") value_unit %>% set_units("°F")  else
             if(units == "m³/m³") value_unit %>% set_units("%") else
               if(units == "mS/cm") value_unit %>% set_units("mS/in") else
                 if(units == "mm/h") value_unit %>% set_units("in/hr") else
                   if(units == "mm") value_unit %>% set_units("in") else
                     if(units == "%") value_unit %>% set_units("%") else
                       if(units == "W/m²") value_unit %>% set_units("W/m²") else
                         if(units == "kPa") value_unit %>% set_units("bar") else
                           if(units == "°") value_unit %>% set_units("°") else
                             if(units == "m/s") value_unit %>% set_units("mi/hr") else
                               if(units == "mV") value_unit %>% set_units("mV") else NA) %>% unlist()) %>%
  mutate(new_units = 
           list(if(units == "°C") "°F"  else
             if(units == "m³/m³") "%" else
               if(units == "mS/cm") "mS/in" else
                 if(units == "mm/h") "in/hr" else
                   if(units == "mm") "in" else
                     if(units == "%") "%" else
                       if(units == "W/m²") "W/m²" else
                         if(units == "kPa") "bars" else
                           if(units == "°") "°" else
                             if(units == "m/s") "mph" else
                               if(units == "mV") "mV" else NA) %>% unlist()) %>%
  mutate(new_value = round(new_value, 2)) %>%
  mutate(value_unit_new = mixed_units(new_value, new_units))

#rename precip
latest$long_name = stringr::str_replace(latest$long_name, "Net precipitation since previous report", 'Precipitation since previous report')

#Define simple plotly fucntion for plotting most vars 
simple_plotly = function(data,name_str,col,ylab,conversion_func){
  data %>%
    dplyr::filter(name == name_str) %>%
    mutate(value = conversion_func(value)) %>%
    transform(id = as.integer(factor(name))) %>%
    plot_ly(x = ~datetime, y = ~value, color = ~name, colors = col, showlegend=F, 
            yaxis = ~paste0("y", id), type = 'scatter', mode = 'lines') %>%
    layout(yaxis = list(
      title = paste0(ylab)))%>%
    add_lines()
}

#define inputs (add precip when ready)
names_str = c("sol_radi", "air_temp", "rel_humi", "wind_spd")
col = c('magenta', 'green', 'black', "orange")
ylab = c("Solar Radiation\n(W/m<sup>2</sup>)", "Air Temperature\n(°F)", "Relative Humidity\n(%)", "Wind Speed\n(mph)")
target_unit = c("W/m²", "°F", "%", "mph")
conversion_func = list(function(x){return(x)}, 
                       function(x){return((x * 9/5)+32)},
                       function(x){return(x)}, 
                       function(x){return(x * 2.237)})

#loop though stations in parallel
cl = makeCluster(4)
registerDoParallel(cl)

# send each R instance the required dependencies
clusterCall(cl, function() {lapply(c("RCurl", "dplyr", "tidyverse", "plotly",
                                     "data.table", "tidyverse", "htmltools",
                                     "htmlwidgets", "knitr", "kableExtra", "units", "lubridate"), library, character.only = TRUE)})

#start foreach loop (parallel)
foreach(s=1:length(stations$`Station ID`)) %dopar% {
  tryCatch({
    #define base dir
    setwd('/home/zhoylman/')
    #define URL for downloading the last 14 days of data, looping by station, end date = surrent time +1 day (all available data)
    url = paste0("https://mesonet.climate.umt.edu/api/observations?stations=",stations$`Station ID`[s], "&latest=false&start_time=",
                 time$start, "&end_time=", time$current+1, "&wide=false&type=csv")
    
    #download data
    data = getURL(url) %>%
      read_csv() %>%
      #force datetime to respect time zone
      mutate(datetime = datetime %>%
               lubridate::with_tz("America/Denver")) %>%
      select(name, value, datetime, units) %>%
      #fill missing obs with NAs for plotting
      complete(datetime = seq(min(.$datetime),max(.$datetime), by = '15 mins'),
               name = unique(.$name))
    
    #compute Reference ET
    etr_data = data %>%
      mutate(hour = lubridate::hour(datetime),
             date = as.Date(datetime)) %>%
      group_by(date,hour,name) %>%
      summarise(mean_value = mean(value, na.rm = T)) %>%
      ungroup() %>%
      pivot_wider(names_from = name, values_from = mean_value) %>%
      mutate(etr = fao_etr(RH = rel_humi, 
                           Temp_C = air_temp, 
                           Rs = sol_radi, 
                           P = atmos_pr, 
                           U = wind_spd)) %>%
      pivot_longer(names_to = "name", values_to = "value", cols = -c(date, hour)) %>%
      mutate(datetime = as.POSIXct(lubridate::ymd(date) + lubridate::hms(paste0(' 0', hour, ':00:00 MST')))) %>%
      select(datetime, name, value) %>% 
      filter(name == 'etr') %>%
      mutate(date = as.Date(datetime)) %>%
      group_by(date, name) %>%
      summarise(value = sum(value)) %>%
      ungroup()
    
    #plot "simple" variables, defined above prior to the foreach loop
    plots = list()
    for(i in 1:length(names_str)){
      plots[[i]] = simple_plotly(data, names_str[i], col[i], ylab[i], conversion_func[[i]])
    }
    
    #plot ETr
    etr_plot = etr_data %>%
      #convert from mm to in
      mutate(value = value/25.4) %>%
      transform(id = as.integer(factor(name))) %>%
      plot_ly(x = ~date, y = ~value, color = ~name, colors = 'red', showlegend=F, 
              yaxis = ~paste0("y", id), type = 'bar') %>%
      layout(yaxis = list(
        title = "Reference ET\n(in)"))
    
    # plot the non-simple vars 
    # Multiple sensors per location (depth)
    vwc = data %>%
      dplyr::filter(name %like% "soilwc") %>%
      mutate(name = name %>%
               str_extract(., "(\\d)+") %>%
               as.numeric() %>%
               paste0(., " in")) %>%
      mutate(value = value * 100) %>%
      plot_ly(x = ~datetime, y = ~value, name = ~name, color = ~name, showlegend=F, colors = "Set2", legendgroup = ~name) %>%
      layout(yaxis = list(
        title = paste0("Soil Moisture\n(%)"),
        legend = list(orientation = 'h'))) %>%
      add_lines()
    
    #soil temp
    temp = data %>%
      dplyr::filter(name %like% "soilt") %>%
      mutate(name = name %>%
               str_extract(., "(\\d)+") %>%
               as.numeric() %>%
               paste0(., " in")) %>%
      dplyr::na_if(0)%>%
      drop_na()%>%
      mutate(value = conversion_func[[2]](value)) %>%
      plot_ly(x = ~datetime, y = ~value, name = ~name, showlegend=T, color = ~name, colors = "Set2", legendgroup = ~name) %>%
      layout(legend = list(orientation = 'h'))%>%
      layout(yaxis = list(
        title = paste0("Soil Temperature\n(°F)"))) %>%
      add_lines()
    
    #precip data (only during summer, need to implement the wet bulb temp conditional)
    precip = data %>%
      dplyr::mutate(yday = lubridate::yday(datetime)) %>%
      dplyr::filter(name == 'precipit') %>%
      dplyr::group_by(yday) %>%
      dplyr::summarise(sum = sum(value, na.rm = T)/25.4,
                       datetime_ave = mean(datetime) %>%
                         as.Date()) %>%
      plot_ly(x = ~datetime_ave, y = ~sum,  showlegend=F, colors = 'blue', type = 'bar', name = 'precip') %>%
      layout(yaxis = list(
        title = paste0("Daily Precipitation Total\n(in)")))
    
    # combine all plots into final plot
    final = subplot(precip, etr_plot, plots[[1]], plots[[2]], plots[[3]], plots[[4]], vwc, temp, nrows = 8, shareX = F, titleY = T, titleX = F) %>%
      config(modeBarButtonsToRemove = c("zoom2d", "pan2d", "select2d", "lasso2d", "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d"))%>%
      config(displaylogo = FALSE)%>%
      config(showTips = TRUE)%>%
      layout(height = 1700) %>%
      saveWidget(., paste0("/home/zhoylman/mesonet-dashboard/data/station_page/current_plots/",stations$`Station ID`[s],"_current_data.html"), selfcontained = F, libdir = "./libs")
    
    # current conditions for the "latest table"
    latest_time = latest %>%
      filter(station_key == stations$`Station ID`[s]) %>%
      select(datetime)%>%
      head(1)
    
    #define variables of interest for "latest table"
    vars_of_interest = c('Air Temperature', 'Relative humidity', 'Wind direction', 'Wind speed',
                         'Maximum wind gust speed since previous report', 'Precipitation since previous report',
                         'Maximum precipiation rate', 'Atmospheric Pressure', 'Solar radiation',
                         'Soil volumetric water content at 0\"','Soil volumetric water content at 4\"','Soil volumetric water content at 8\"',
                         'Soil volumetric water content at 20\"', 'Soil volumetric water content at 36\"',
                         'Soil temperature at 0\"', 'Soil temperature at 4\"', 'Soil temperature at 8\"', 'Soil temperature at 20\"',
                         'Soil temperature at 36\"', 'Vapor pressure deficit', 'Battery Percent', 'Battery Voltage')
    
    # generate teh latest table and save as a HTML widget (kable)
    latest %>%
      filter(station_key == stations$`Station ID`[s]) %>% 
      select("long_name", "value_unit_new", "new_units") %>%
      rename(Observation = long_name, Value = value_unit_new, Units = new_units)%>%
      dplyr::filter(Observation %in% vars_of_interest) %>%
      arrange(factor(Observation, levels = vars_of_interest))%>%
      kable(., "html", caption = paste0("Latest observation was at ", latest_time[1]$datetime %>% as.character()), col.names = NULL)%>%
      kable_styling(bootstrap_options = c("striped", "hover", "condensed", "responsive"))%>%
      save_kable(file = paste0("/home/zhoylman/mesonet-dashboard/data/station_page/latest_table/",stations$`Station ID`[s],"_current_table.html"),  self_contained = F, libdir = "./libs")
    
    #clean up header artifact
    temp_html = paste(readLines(paste0("/home/zhoylman/mesonet-dashboard/data/station_page/latest_table/",stations$`Station ID`[s],"_current_table.html"))) %>%
      gsub("<p>&lt;!DOCTYPE html&gt; ", "", .)%>%
      writeLines(., con = paste0("/home/zhoylman/mesonet-dashboard/data/station_page/latest_table/",stations$`Station ID`[s],"_current_table.html"))
    
    #fin
  }, error = function(e){
    paste0('Error on station: ', stations$`Station ID`[s])
  })
}

## mobile Sandbox
## Not done here, this is to make more visually apealling mobile plots

# data_mobile = data %>%
#   dplyr::filter(datetime > time$current - 3)
# 
# mobile = plot_ly(data_mobile) %>%
#   add_lines(x = ~datetime[name == "air_temp"], y = ~value[name == "air_temp"], name = "Air Temp", visible = T, color=I("green"), showlegend=F) %>%
#   add_lines(x = ~datetime[name == "sol_radi"], y = ~value[name == "sol_radi"], name = "Solar Radiation", visible = F, color=I("red"), showlegend=F) %>%
#   add_lines(x = ~datetime[name == "rel_humi"], y = ~value[name == "rel_humi"], name = "Relitive Humidity", visible = F, color=I("orange"), showlegend=F) %>%
#   layout(autosize = T,
#     yaxis = list(title = "y"),
#     updatemenus = list(
#       list(
#         y = 1.1,
#         x = 0.1,
#         buttons = list(
#           list(method = "restyle",
#                args = list("visible", list(TRUE, FALSE, FALSE)),
#                label = "Air Temp"),
#           list(method = "restyle",
#                args = list("visible", list(FALSE, TRUE, FALSE)),
#                label = "Solar Radiation"),
#           list(method = "restyle",
#                args = list("visible", list(FALSE, FALSE, TRUE)),
#                label = "Relitive Humidity")))
#     )
#   ) %>%
#   htmlwidgets::saveWidget(., paste0("~/MCO/data/mesonet/station_page/current_plots/mobile_test.html"), selfcontained = F, libdir = "./libs")
