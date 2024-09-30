library(magrittr)

get_gridmet <- function(lat, lon, start_date, end_date, variable, name) {
  print(glue::glue("Doing {variable} for {name}..."))
  nc <- glue::glue(
    "http://thredds.northwestknowledge.net:8080/thredds/dodsC/agg_met_{variable}_1979_CurrentYear_CONUS.nc#fillmismatch"
  ) %>%
    ncdf4::nc_open()

  # retrieve meta data from nc file for extraction
  # file dimensions are lon,lat,time
  nc_meta <- nc$var[[1]]

  # calculate the time series
  time <- ncdf4::ncvar_get(nc, "day", start = c(1), count = c(nc_meta$varsize[3])) %>%
    as.Date(., origin = "1900-01-01")

  ### define matrix of lat lon to find pixel of interest
  lon_matrix <- nc$var[[1]]$dim[[1]]$vals
  lat_matrix <- nc$var[[1]]$dim[[2]]$vals

  # find lat long that corispond (minimize difference)
  lon <- which(abs(lon_matrix - lon) == min(abs(lon_matrix - lon)))
  lat <- which(abs(lat_matrix - lat) == min(abs(lat_matrix - lat)))

  ## READ THE DATA VARIABLE
  data <- ncdf4::ncvar_get(
    nc, nc_meta$name,
    start = c(lon, lat, 1), count = c(1, 1, nc_meta$varsize[3])
  )

  # PUT EVERYTHING INTO A DATA FRAME and filter for time
  dataset <- tibble::tibble(
    "date" = time,
    "value" = data,
    "station" = name
  ) %>%
    dplyr::filter(date >= start_date, date <= end_date) %>%
    dplyr::mutate(
      month = lubridate::month(date),
      day = lubridate::day(date)
    )

  ## CLOSE THE FILE
  ncdf4::nc_close(nc)

  # garbage collect
  gc()

  return(dataset)
}

station_locs <- readr::read_csv(
  "https://mesonet.climate.umt.edu/api/v2/stations/?type=csv",
  show_col_types = FALSE
)

existing_normals <- list.files("./normals", pattern = ".csv", full.names = T) %>%
  basename() %>%
  stringr::str_split("_") %>%
  purrr::map(magrittr::extract(1)) %>%
  unlist() %>%
  unique()

station_locs <- station_locs %>% 
  dplyr::filter(!(station %in% existing_normals))

l <- list(
  lat = station_locs$latitude,
  lon = station_locs$longitude,
  start = rep(as.Date("1991-01-01"), nrow(station_locs)),
  end = rep(as.Date("2022-01-01"), nrow(station_locs)),
  name = station_locs$station
)

out <- purrr::map(
  c("pet", "pr", "rmax", "rmin", "tmmn", "tmmx"),
  function(x) {
    purrr::pmap(
      l,
      purrr::possibly(
        function(lat, lon, start, end, name) {
          get_gridmet(
            lat, 
            lon, 
            start, 
            end, 
            x, 
            name
          )
        },
        # Return an empty tibble if an error occurs
        tibble::tibble()
      )
    )
  }
)


purrr::pmap(
  list(
    variable = c("pet", "pr", "rmax", "rmin", "tmmn", "tmmx"),
    dat = out
  ), 
  function(variable, dat) {
    dplyr::bind_rows(dat) %>% 
      dplyr::mutate(variable = variable)
  }
) %>% 
dplyr::bind_rows() %>% 
  dplyr::mutate(
    value = dplyr::case_when(
      variable %in% c("pet", "pr") ~ value / 25.4,
      variable %in% c("tmmn", "tmmx") ~ (value - 273.15) * 1.8 + 32,
      TRUE ~ value
    )
  ) %>% 
  dplyr::group_by(month, day, station, variable) %>% 
  dplyr::summarise(
    mean = mean(value) %>% round(4),
    std_dev = sd(value) %>% round(4),
    median = median(value) %>% round(4),
    q25 = quantile(value, 0.25) %>% round(4),
    q75 = quantile(value, 0.75) %>% round(4)
  ) %>% 
  dplyr::mutate(type = "daily") %>% 
  dplyr::group_by(station, variable) %>% 
  dplyr::group_split() %>% 
  purrr::map(function(x) {
    name = glue::glue("{x$station[1]}_{x$variable[1]}.csv")
    name = file.path("./normals", name)
    readr::write_csv(x, name)
  })

