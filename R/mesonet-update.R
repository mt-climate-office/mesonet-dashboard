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

# httr::GET(url = "https://cfcmesonet.cfc.umt.edu/api/latest", 
#           query = list(stations=c("arskeogh"),type = "csv")) %>%
#   httr::content()

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
           lubridate::with_tz("America/Denver"))%>%
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
                         if(units == "kPa") value_unit %>% set_units("kPa") else
                           if(units == "°") value_unit %>% set_units("°") else
                             if(units == "m/s") value_unit %>% set_units("ft/s") else
                               if(units == "mV") value_unit %>% set_units("mV") else NA) %>%
  mutate(new_units = 
           if(units == "°C") "°F"  else
             if(units == "m³/m³") "%" else
               if(units == "mS/cm") "mS/in" else
                 if(units == "mm/h") "in/hr" else
                   if(units == "mm") "in" else
                     if(units == "%") "%" else
                       if(units == "W/m²") "W/m²" else
                         if(units == "kPa") "kPa" else
                           if(units == "°") "°" else
                             if(units == "m/s") "ft/s" else
                               if(units == "mV") "mV" else NA) %>%
  mutate(new_value = round(new_value, 2)) %>%
  mutate(value_unit_new = mixed_units(new_value, new_units))

#define simple plotting fuction (using units)
# simple_plotly = function(data,name_str,col,ylab,target_unit){
#   data %>%
#     dplyr::filter(name == name_str) %>%
#     mutate(value_unit = mixed_units(value, units) %>%
#              set_units(target_unit)) %>%
#     transform(id = as.integer(factor(name))) %>%
#     plot_ly(x = ~datetime, y = ~value_unit, color = ~name, colors = col, showlegend=F, 
#             yaxis = ~paste0("y", id)) %>%
#     layout(yaxis = list(
#       title = paste0(ylab)))%>%
#     add_lines()
# }

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
ylab = c("Solar Radiation\n(W/m<sup>2</sup>)", "Air Temperature\n(°F)", "Relative Humidity\n(%)", "Wind Speed\n(ft/s)")
target_unit = c("W/m²", "°F", "%", "ft/s")
conversion_func = list(function(x){return(x)}, 
                       function(x){return((x * 9/5)+32)},
                       function(x){return(x)}, 
                       function(x){return(x * 3.28084)})

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
    plot_ly(x = ~datetime, y = ~value, name = ~name, color = ~name, showlegend=T, colors = "Set2") %>%
    layout(yaxis = list(
      title = paste0("Soil Moisture\n(%)"))) %>%
    add_lines()
  
  temp = data %>%
    dplyr::filter(name %like% "soilt") %>%
    mutate(name = name %>%
             str_extract(., "(\\d)+") %>%
             as.numeric() %>%
             paste0(., " in")) %>%
    mutate(value = conversion_func[[2]](value)) %>%
    plot_ly(x = ~datetime, y = ~value, name = ~name, showlegend=F, color = ~name, colors = "Set2") %>%
    layout(yaxis = list(
      title = paste0("Soil Temperature\n(°F)"))) %>%
    add_lines()
  
  # define title annotation
  a <- list(
    text = paste0(stations$`Station name`[s], " (", round((stations$`Elevation (masl)`[s] * 3.28084),0), " ft elevation)"),
    xref = "paper",
    yref = "paper",
    yanchor = "bottom",
    xanchor = "center",
    align = "center",
    x = 0.5,
    y = 1,
    showarrow = FALSE
  )
  
  #combine all plots into final plot
  final = subplot(plots[[1]], plots[[2]], plots[[3]], plots[[4]], vwc, temp, nrows = 6, shareX = T, titleY = T, titleX = T) %>%
    layout(annotations = a)%>%
    layout(height = 1500) %>%
    layout(legend = list(x = 100, y = 0.1),
           xaxis = list(
             title = "Time"
           )) %>%
    saveWidget(., paste0("/home/zhoylman/mesonet-dashboard/data/station_page/current_plots/",stations$`Station ID`[s],"_current_data.html"), selfcontained = F, libdir = "./libs")
  
  ## current conditions
  latest_time = latest %>%
    filter(station_key == stations$`Station ID`[s]) %>%
    select(datetime)%>%
    head(1)
  
  latest %>%
    filter(station_key == stations$`Station ID`[s]) %>% 
    select("long_name", "value_unit_new", "new_units") %>%
    rename(Observation = long_name, Value = value_unit_new, Units = new_units)%>%
    kable(., "html", caption = paste0("Latest observation was at ", latest_time[1]$datetime %>% as.character()))%>%
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