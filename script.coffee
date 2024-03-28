# Define a function to update the time
updateTime = ->
  now = new Date()
  hours = now.getHours()
  minutes = now.getMinutes()
  seconds = now.getSeconds()
  timeString = "#{hours}:#{minutes}:#{seconds}"
  document.getElementById("time").textContent = timeString

# Call the updateTime function initially to set the time
updateTime()

# Update the time every second
setInterval updateTime, 1000
