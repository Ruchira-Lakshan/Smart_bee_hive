import { useEffect, useMemo, useState } from 'react'

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
  })

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './lib/supabaseClient'
import './App.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const MAX_POINTS = 60

const PALETTE = {
  amber: '#ffb703',
  gold: '#f4a259',
  orange: '#ef8354',
  teal: '#34c3b2',
  red: '#ff5f6d',
}

const SOUND_BANDS = [
  {
    id: 'low',
    label: 'Low Hum Band',
    range: [50, 150],
    tone: 'Colony calm and clustered. Maintain ventilation.',
    accent: PALETTE.amber,
  },
  {
    id: 'activity',
    label: 'Activity Buzz Band',
    range: [150, 300],
    tone: 'Workers active. Ensure nectar and brood frames are balanced.',
    accent: PALETTE.gold,
  },
  {
    id: 'communication',
    label: 'Communication Queen Band',
    range: [300, 600],
    tone: 'Queen piping or waggle signals. Inspect queen cells soon.',
    accent: PALETTE.orange,
  },
  {
    id: 'stress',
    label: 'Intrusion or Stress',
    range: [600, 1000],
    tone: 'Possible predator, robbing, or overheating. Open hive gently and investigate.',
    accent: PALETTE.red,
  },
]

const SplashScreen = ({ status }) => (
  <motion.div
    className="splash"
    initial={{ opacity: 1 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, transition: { duration: 0.6 } }}
  >
    <div className="splash-content">
      <div className="hex-spinner">
        <span />
        <span />
        <span />
      </div>
      <p>{status}</p>
    </div>
  </motion.div>
)

const StatCard = ({ label, value, suffix, trend, icon }) => (
  <motion.div
    className="stat-card"
    whileHover={{ translateY: -4 }}
    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
  >
    <div className="stat-card__header">
      <span>{label}</span>
      <span className="stat-card__icon">{icon}</span>
    </div>
    <p className="stat-card__value">
      {value}
      <small>{suffix}</small>
    </p>
    <span className={`stat-card__trend ${trend >= 0 ? 'up' : 'down'}`}>
      {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
    </span>
  </motion.div>
)

const ChartPanel = ({ title, dataset, color, isMobile }) => {
  
  return (
    <div className="chart-panel">
      <div className="chart-panel__header">
        <h3>{title}</h3>
      </div>
      <div className="chart-wrapper">
        <Line
          options={{
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: isMobile ? 1.8 : 2.2,
            tension: 0.45,
            interaction: {
              intersect: false,
              mode: 'index',
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15,15,21,0.95)',
                padding: isMobile ? 8 : 12,
                titleFont: { 
                  family: 'system-ui, sans-serif',
                  size: isMobile ? 11 : 13,
                },
                bodyFont: { 
                  family: 'system-ui, sans-serif',
                  size: isMobile ? 11 : 12,
                },
                cornerRadius: 8,
                displayColors: false,
              },
            },
            scales: {
              y: {
                ticks: { 
                  color: 'var(--bee-text-muted)',
                  font: { size: isMobile ? 10 : 11 },
                  maxTicksLimit: isMobile ? 5 : 7,
                },
                grid: { color: 'rgba(255,255,255,0.06)' },
              },
              x: {
                ticks: { 
                  color: 'var(--bee-text-muted)',
                  font: { size: isMobile ? 9 : 10 },
                  maxTicksLimit: isMobile ? 6 : 10,
                },
                grid: { display: false },
              },
            },
          }}
          data={{
            labels: dataset.labels,
            datasets: [
              {
                data: dataset.values,
                borderColor: color,
                backgroundColor: context => {
                  const chart = context.chart
                  const { ctx, chartArea } = chart
                  if (!chartArea) return color + '33'
                  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                  gradient.addColorStop(0, color + '55')
                  gradient.addColorStop(1, color + '00')
                  return gradient
                },
                borderWidth: isMobile ? 2 : 2.6,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: isMobile ? 3 : 4,
              },
            ],
          }}
        />
      </div>
    </div>
  )
}

const formatLabel = (reading, index) => {
  if (reading?.created_at) {
    return new Date(reading.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return `#${index + 1}`
}

const calculateTrend = values => {
  if (!values || values.length < 2) return 0
  const slice = values.slice(-6)
  const first = slice[0]
  const last = slice.at(-1)
  if (!first || !last) return 0
  if (first === 0) return (last - first) * 100
  return ((last - first) / first) * 100
}

function App() {
  const [readings, setReadings] = useState([])
  const [status, setStatus] = useState('Warming hive monitors…')
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const { width } = useWindowSize()
  const isMobile = width < 640

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 1400)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadInitial = async () => {
      setStatus('Syncing last 60 readings…')
      const { data, error: fetchError } = await supabase
        .from('readings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_POINTS)

      if (!isMounted) return

      if (fetchError) {
        setError('Unable to load hive data. Check Supabase connection.')
        setStatus('Connection lost')
      } else {
        setReadings((data ?? []).reverse())
        setStatus('Live telemetry streaming')
      }
    }

    loadInitial()

    const channel = supabase
      .channel('readings-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings' },
        payload => {
          setReadings(prev => {
            const queue = [...prev, payload.new]
            if (queue.length > MAX_POINTS) queue.shift()
            return queue
          })
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('Live telemetry streaming')
        }
      })

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const latest = readings.at(-1)

  const soundBand = useMemo(() => {
    if (!latest?.sound_value) return null
    return SOUND_BANDS.find(
      band => latest.sound_value >= band.range[0] && latest.sound_value < band.range[1],
    )
  }, [latest])

  const tempChart = useMemo(
    () => ({
      labels: readings.map((reading, index) => formatLabel(reading, index)),
      values: readings.map(r => r.temperature ?? 0),
    }),
    [readings],
  )

  const humidityChart = useMemo(
    () => ({
      labels: readings.map((reading, index) => formatLabel(reading, index)),
      values: readings.map(r => r.humidity ?? 0),
    }),
    [readings],
  )

  const soundWave = useMemo(
    () => ({
      labels: readings.map((reading, index) => formatLabel(reading, index)),
      values: readings.map(r => r.sound_value ?? 0),
    }),
    [readings],
  )

  const showSplash = !isReady || (!latest && !error)

  const alertBand =
    soundBand && (soundBand.id === 'communication' || soundBand.id === 'stress')
      ? soundBand
      : null

  return (
    <div className="hive-app">
      <AnimatePresence>{showSplash && <SplashScreen status={status} />}</AnimatePresence>

      <header className="hive-hero">
        <div>
          <p className="hero-label">Aurora Apiary</p>
          <h1>Beehive Vital Signs</h1>
          <p className="hero-meta">{status}</p>
        </div>
        {latest && (
          <motion.div
            className="hero-pill"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span>Last update</span>
            <strong>
              {latest.created_at
                ? new Date(latest.created_at).toLocaleTimeString()
                : 'just now'}
            </strong>
          </motion.div>
        )}
      </header>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      <section className="stats-grid">
        <StatCard
          label="Temperature"
          value={latest?.temperature ?? '—'}
          suffix="°C"
          trend={calculateTrend(readings.map(r => r.temperature))}
          icon="🌡️"
        />
        <StatCard
          label="Humidity"
          value={latest?.humidity ?? '—'}
          suffix="%"
          trend={calculateTrend(readings.map(r => r.humidity))}
          icon="💧"
        />
        <StatCard
          label="Sound Energy"
          value={latest?.sound_value ?? '—'}
          suffix="Hz"
          trend={calculateTrend(readings.map(r => r.sound_value))}
          icon="🎧"
        />
        <StatCard
          label="Band"
          value={soundBand?.label ?? 'No signal'}
          suffix=""
          trend={0}
          icon="🐝"
        />
      </section>

      <section className="charts">
        <ChartPanel title="Temperature °C" dataset={tempChart} color={PALETTE.amber} isMobile={isMobile} />
        <ChartPanel title="Humidity %" dataset={humidityChart} color={PALETTE.teal} isMobile={isMobile} />
        <div className="chart-panel waveform">
          <div className="chart-panel__header">
            <h3>Sound Waveform</h3>
            {soundBand && <span style={{ color: soundBand.accent }}>{soundBand.label}</span>}
          </div>
          <div className="chart-wrapper">
            <Line
              options={{
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: isMobile ? 2.5 : 3.5,
                tension: 0.35,
                interaction: {
                  intersect: false,
                  mode: 'index',
                },
                plugins: {
                  legend: { display: false },
                  tooltip: { enabled: false },
                },
                scales: {
                  y: {
                    ticks: { display: false },
                    grid: { display: false },
                  },
                  x: {
                    ticks: { display: false },
                    grid: { display: false },
                  },
                },
              }}
              data={{
                labels: soundWave.labels,
                datasets: [
                  {
                    data: soundWave.values,
                    borderColor: soundBand?.accent ?? PALETTE.gold,
                    borderWidth: isMobile ? 1.5 : 2,
                    fill: {
                      target: 'origin',
                      above: 'rgba(255,191,0,0.25)',
                      below: 'rgba(255,191,0,0.25)',
                    },
                    pointRadius: 0,
                  },
                ],
              }}
            />
          </div>
        </div>
      </section>

      <section className="band-grid">
        {SOUND_BANDS.map(band => {
          const active = band.id === soundBand?.id
          return (
            <motion.article
              key={band.id}
              className={`band-card ${active ? 'active' : ''}`}
              style={{ borderColor: active ? band.accent : 'transparent' }}
              initial={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
            >
              <header>
                <h4>{band.label}</h4>
                <span>
                  {band.range[0]} - {band.range[1]} Hz
                </span>
              </header>
              <p>{band.tone}</p>
              {active && <em>Currently detected</em>}
            </motion.article>
          )
        })}
      </section>

      <AnimatePresence>
        {alertBand && (
          <motion.div
            className="alert-pop"
            initial={{ opacity: 0, translateY: 30 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: 30 }}
          >
            <strong>{alertBand.label} alert</strong>
            <p>{alertBand.tone}</p>
            <button
              type="button"
              onClick={() => window.open('https://bee-health.com/management', '_blank')}
            >
              Show Response Playbook
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
