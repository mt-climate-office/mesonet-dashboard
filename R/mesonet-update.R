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

#loop though stations
cl = makeCluster(4)
registerDoParallel(cl)

#
clusterCall(cl, function() {lapply(c("RCurl", "dplyr", "tidyverse", "plotly",
                                     "data.table", "tidyverse", "htmltools",
                                     "htmlwidgets", "knitr", "kableExtra", "units"), library, character.only = TRUE)})

start = Sys.time()
foreach(s=1:length(stations$`Station ID`)) %dopar% {
  setwd('/home/zhoylman/')
  source('/home/zhoylman/mesonet-dashboard/R/mesonet-build-rmd.R')
  url = paste0("https://cfcmesonet.cfc.umt.edu/api/observations?stations=",stations$`Station ID`[s], "&latest=false&start_time=",
               time$start, "&end_time=", time$current+1, "&tz=US%2FMountain&wide=false&type=csv")
  
  #download data
  data = getURL(url) %>%
    read_csv() %>%
    mutate(datetime = datetime %>%
             lubridate::with_tz("America/Denver")) %>%
    select(name, value, datetime, units) 
  
  #plot simple plotly (single sensor)
  plots = list()
  for(i in 1:length(names_str)){
    plots[[i]] = simple_plotly(data, names_str[i], col[i], ylab[i], conversion_func[[i]])
  }
  
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
  
  #combine all plots into final plot
  final = subplot(precip, plots[[1]], plots[[2]], plots[[3]], plots[[4]], vwc, temp, nrows = 7, shareX = F, titleY = T, titleX = F) %>%
    config(modeBarButtonsToRemove = c("zoom2d", "pan2d", "select2d", "lasso2d", "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d"))%>%
    config(displaylogo = FALSE)%>%
    config(showTips = TRUE)%>%
    layout(height = 1700) %>%
    saveWidget(., paste0("/home/zhoylman/mesonet-dashboard/data/station_page/current_plots/",stations$`Station ID`[s],"_current_data.html"), selfcontained = F, libdir = "./libs")
  
  ## current conditions
  latest_time = latest %>%
    filter(station_key == stations$`Station ID`[s]) %>%
    select(datetime)%>%
    head(1)
  
  vars_of_interest = c('Air Temperature', 'Relative humidity', 'Wind direction', 'Wind speed',
                       'Maximum wind gust speed since previous report', 'Precipitation since previous report',
                       'Maximum precipiation rate', 'Atmospheric Pressure', 'Solar radiation',
                       'Soil volumetric water content at 0\"','Soil volumetric water content at 4\"','Soil volumetric water content at 8\"',
                       'Soil volumetric water content at 20\"', 'Soil volumetric water content at 36\"',
                       'Soil temperature at 0\"', 'Soil temperature at 4\"', 'Soil temperature at 8\"', 'Soil temperature at 20\"',
                       'Soil temperature at 36\"', 'Vapor pressure deficit', 'Battery Percent', 'Battery Voltage')
  
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
  
  #write out final page from RMD
  #mesonet_build_rmd(stations$Latitude[s], stations$Longitude[s], stations$`Station ID`[s], stations$`Station name`[s])
}

Sys.time() - start
stopCluster(cl)
Sys.time() - true_start


## mobile Sandbox

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
