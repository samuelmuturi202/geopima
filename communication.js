document.addEventListener('DOMContentLoaded', () => {

  // Dates matching graph dataset in image (July 11 to Aug 09)
  const dateLabels = [
    '11-07', '12-07', '13-07', '14-07', '15-07', '16-07', '17-07', '18-07', 
    '19-07', '20-07', '21-07', '22-07', '23-07', '24-07', '25-07', '26-07', 
    '27-07', '28-07', '29-07', '30-07', '31-07', '01-08', '02-08', '03-08', 
    '04-08', '05-08', '06-08', '07-08', '08-08', '09-08'
  ];

  // Data approximations matching the peak distribution in image
  const sentData = [
    1080, 210, 180, 760, 120, 100, 110, 100, 80, 90, 60, 50, 40, 380, 70, 
    60, 50, 45, 40, 40, 45, 1460, 70, 130, 120, 150, 1310, 170, 190, 110
  ];

  const deliveredData = [
    440, 160, 150, 360, 100, 70, 75, 80, 70, 70, 35, 30, 25, 180, 50, 
    45, 40, 30, 30, 30, 35, 910, 50, 110, 100, 110, 550, 150, 50, 20
  ];

  // Render Dual-Bar Chart
  const ctx = document.getElementById('smsAnalyticsChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dateLabels,
      datasets: [
        {
          label: 'Sent',
          data: sentData,
          backgroundColor: '#007bff',
          borderRadius: 2,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        },
        {
          label: 'Delivered',
          data: deliveredData,
          backgroundColor: '#28a745',
          borderRadius: 2,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          align: 'end',
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 10
            }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 200,
            callback: function(value) {
              return value + 'p';
            },
            font: {
              size: 10
            }
          },
          grid: {
            color: '#f0f0f0'
          }
        }
      }
    }
  });

  // Action Button Handlers
  const actionButtons = document.querySelectorAll('.sms-btn');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const buttonText = e.target.innerText;
      alert(`Initiating command: "${buttonText}"`);
    });
  });

});