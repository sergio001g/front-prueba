import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const STATUS_OPTIONS = ['pendiente', 'proceso', 'hecho']
const OWNER_OPTIONS = [
  { value: 'sergio', label: 'Sergio' },
  { value: 'isaac', label: 'Isaac' },
]

const getToken = () => localStorage.getItem('token')
const storageAvailable = () => typeof localStorage !== 'undefined'
const clientsStorageKey = 'ventas_clients'
const taskStorageKey = (owner) => `ventas_tasks_${owner}`
const getStoredClients = () => {
  if (!storageAvailable()) return []
  const raw = localStorage.getItem(clientsStorageKey)
  return raw ? JSON.parse(raw) : []
}
const setStoredClients = (value) => {
  if (!storageAvailable()) return
  localStorage.setItem(clientsStorageKey, JSON.stringify(value))
}
const getStoredTasks = (owner) => {
  if (!storageAvailable()) return []
  const raw = localStorage.getItem(taskStorageKey(owner))
  return raw ? JSON.parse(raw) : []
}
const setStoredTasks = (owner, value) => {
  if (!storageAvailable()) return
  localStorage.setItem(taskStorageKey(owner), JSON.stringify(value))
}

function App() {
  const apiUrl = useMemo(
    () => import.meta.env.VITE_API_URL || 'http://localhost:3000',
    [],
  )
  const [token, setToken] = useState(getToken())
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  })

  const [clients, setClients] = useState(() => getStoredClients())
  const [clientForm, setClientForm] = useState({
    name: '',
    description: '',
    price: '',
  })
  const [clientEditId, setClientEditId] = useState(null)
  const [clientEditForm, setClientEditForm] = useState({
    name: '',
    description: '',
    price: '',
    status: 'pendiente',
  })

  const [tasks, setTasks] = useState(() => getStoredTasks('sergio'))
  const [taskOwnerFilter, setTaskOwnerFilter] = useState('sergio')
  const [taskForm, setTaskForm] = useState({
    title: '',
    owner: 'sergio',
  })
  const [taskEditId, setTaskEditId] = useState(null)
  const [taskEditForm, setTaskEditForm] = useState({
    title: '',
    owner: 'sergio',
    status: 'pendiente',
  })

  const headers = useMemo(() => {
    if (!token) {
      return { 'Content-Type': 'application/json' }
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }, [token])

  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${apiUrl}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const message = data?.message || 'Error inesperado'
        throw new Error(message)
      }
      return response.json().catch(() => ({}))
    },
    [apiUrl, headers],
  )

  const setClientsAndStore = useCallback((value) => {
    setClients(value)
    setStoredClients(value)
  }, [])

  const setTasksAndStore = useCallback((owner, value) => {
    setTasks(value)
    setStoredTasks(owner, value)
  }, [])

  const loadSession = useCallback(async () => {
    if (!token) {
      setUser(null)
      return
    }
    try {
      const data = await request('/auth/me')
      setUser(data.user)
    } catch {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    }
  }, [request, token])

  const loadClients = useCallback(async () => {
    try {
      const data = await request('/clients')
      if (Array.isArray(data) && data.length > 0) {
        setClientsAndStore(data)
        return
      }
      const stored = getStoredClients()
      setClients(stored)
    } catch {
      const stored = getStoredClients()
      setClients(stored)
    }
  }, [request, setClientsAndStore])

  const loadTasks = useCallback(
    async (owner) => {
      try {
        const data = await request(`/tasks?owner=${owner}`)
        if (Array.isArray(data) && data.length > 0) {
          setTasksAndStore(owner, data)
          return
        }
        const stored = getStoredTasks(owner)
        setTasks(stored)
      } catch {
        const stored = getStoredTasks(owner)
        setTasks(stored)
      }
    },
    [request, setTasksAndStore],
  )

  useEffect(() => {
    loadSession()
  }, [loadSession])

  useEffect(() => {
    if (token) {
      loadClients()
      loadTasks(taskOwnerFilter)
    }
  }, [token, taskOwnerFilter, loadClients, loadTasks])

  useEffect(() => {
    if (user?.username) {
      setTaskOwnerFilter(user.username)
      setTaskForm((prev) => ({ ...prev, owner: user.username }))
      setTaskEditForm((prev) => ({ ...prev, owner: user.username }))
    }
  }, [user])

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
        headers: { 'Content-Type': 'application/json' },
      })
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
      setClients([])
      setTasks([])
  }

  const handleCreateClient = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    const payload = {
      name: clientForm.name.trim(),
      description: clientForm.description.trim(),
      price: Number(clientForm.price),
    }
    try {
      await request('/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setClientForm({ name: '', description: '', price: '' })
      await loadClients()
    } catch (err) {
      const fallback = {
        id: Date.now(),
        name: payload.name,
        description: payload.description,
        price: payload.price,
        status: 'pendiente',
      }
      const next = [...clients, fallback]
      setClientsAndStore(next)
      setClientForm({ name: '', description: '', price: '' })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startEditClient = (client) => {
    setClientEditId(client.id)
    setClientEditForm({
      name: client.name,
      description: client.description,
      price: String(client.price),
      status: client.status,
    })
  }

  const cancelEditClient = () => {
    setClientEditId(null)
  }

  const handleUpdateClient = async (event) => {
    event.preventDefault()
    if (!clientEditId) return
    setError('')
    setLoading(true)
    const payload = {
      name: clientEditForm.name.trim(),
      description: clientEditForm.description.trim(),
      price: Number(clientEditForm.price),
      status: clientEditForm.status,
    }
    try {
      await request(`/clients/${clientEditId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setClientEditId(null)
      await loadClients()
    } catch (err) {
      const next = clients.map((client) =>
        client.id === clientEditId ? { ...client, ...payload } : client,
      )
      setClientsAndStore(next)
      setClientEditId(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClient = async (id) => {
    setError('')
    setLoading(true)
    try {
      await request(`/clients/${id}`, { method: 'DELETE' })
      await loadClients()
    } catch (err) {
      const next = clients.filter((client) => client.id !== id)
      setClientsAndStore(next)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    const payload = {
      title: taskForm.title.trim(),
      owner: taskForm.owner,
    }
    try {
      await request('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setTaskForm((prev) => ({ ...prev, title: '' }))
      await loadTasks(taskOwnerFilter)
    } catch (err) {
      const fallback = {
        id: Date.now(),
        title: payload.title,
        owner: payload.owner,
        status: 'pendiente',
      }
      const next = [...tasks, fallback]
      setTasksAndStore(taskOwnerFilter, next)
      setTaskForm((prev) => ({ ...prev, title: '' }))
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startEditTask = (task) => {
    setTaskEditId(task.id)
    setTaskEditForm({
      title: task.title,
      owner: task.owner,
      status: task.status,
    })
  }

  const cancelEditTask = () => {
    setTaskEditId(null)
  }

  const handleUpdateTask = async (event) => {
    event.preventDefault()
    if (!taskEditId) return
    setError('')
    setLoading(true)
    const payload = {
      title: taskEditForm.title.trim(),
      owner: taskEditForm.owner,
      status: taskEditForm.status,
    }
    try {
      await request(`/tasks/${taskEditId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setTaskEditId(null)
      await loadTasks(taskOwnerFilter)
    } catch (err) {
      const next = tasks.map((task) =>
        task.id === taskEditId ? { ...task, ...payload } : task,
      )
      setTasksAndStore(taskOwnerFilter, next)
      setTaskEditId(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTask = async (id) => {
    setError('')
    setLoading(true)
    try {
      await request(`/tasks/${id}`, { method: 'DELETE' })
      await loadTasks(taskOwnerFilter)
    } catch (err) {
      const next = tasks.filter((task) => task.id !== id)
      setTasksAndStore(taskOwnerFilter, next)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token || !user) {
    return (
      <div className="page">
        <div className="card">
          <h1>Sistema de ventas</h1>
          <p>Acceso solo para Sergio e Isaac</p>
          <form className="form" onSubmit={handleLogin}>
            <label>
              Usuario
              <select
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
              >
                <option value="">Selecciona usuario</option>
                <option value="sergio">sergio</option>
                <option value="isaac">isaac</option>
              </select>
            </label>
            <label>
              Clave
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Sistema de ventas</h1>
          <p>Sesión activa: {user.name}</p>
        </div>
        <button type="button" onClick={handleLogout}>
          Salir
        </button>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="section">
        <div className="section-header">
          <h2>Clientes</h2>
        </div>

        <form className="form-grid" onSubmit={handleCreateClient}>
          <input
            placeholder="Nombre"
            value={clientForm.name}
            onChange={(event) =>
              setClientForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <input
            placeholder="Descripción"
            value={clientForm.description}
            onChange={(event) =>
              setClientForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
          <input
            placeholder="Precio"
            type="number"
            value={clientForm.price}
            onChange={(event) =>
              setClientForm((prev) => ({ ...prev, price: event.target.value }))
            }
          />
          <button type="submit" disabled={loading}>
            Agregar
          </button>
        </form>

        <div className="list">
          {clients.length === 0 ? (
            <p className="empty">No hay clientes registrados.</p>
          ) : (
            clients.map((client) => (
              <div className="list-item" key={client.id}>
                {clientEditId === client.id ? (
                  <form className="edit-form" onSubmit={handleUpdateClient}>
                    <input
                      value={clientEditForm.name}
                      onChange={(event) =>
                        setClientEditForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                    <input
                      value={clientEditForm.description}
                      onChange={(event) =>
                        setClientEditForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="number"
                      value={clientEditForm.price}
                      onChange={(event) =>
                        setClientEditForm((prev) => ({
                          ...prev,
                          price: event.target.value,
                        }))
                      }
                    />
                    <select
                      value={clientEditForm.status}
                      onChange={(event) =>
                        setClientEditForm((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <div className="row-actions">
                      <button type="submit" disabled={loading}>
                        Guardar
                      </button>
                      <button type="button" onClick={cancelEditClient}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="row">
                    <div>
                      <h3>{client.name}</h3>
                      <p>{client.description}</p>
                      <p className="meta">
                        ${client.price} - {client.status}
                      </p>
                    </div>
                    <div className="row-actions">
                      <button type="button" onClick={() => startEditClient(client)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteClient(client.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Tareas diarias</h2>
          <select
            value={taskOwnerFilter}
            onChange={(event) => setTaskOwnerFilter(event.target.value)}
          >
            {OWNER_OPTIONS.map((owner) => (
              <option key={owner.value} value={owner.value}>
                {owner.label}
              </option>
            ))}
          </select>
        </div>

        <form className="form-grid" onSubmit={handleCreateTask}>
          <input
            placeholder="Nueva tarea"
            value={taskForm.title}
            onChange={(event) =>
              setTaskForm((prev) => ({ ...prev, title: event.target.value }))
            }
          />
          <select
            value={taskForm.owner}
            onChange={(event) =>
              setTaskForm((prev) => ({ ...prev, owner: event.target.value }))
            }
          >
            {OWNER_OPTIONS.map((owner) => (
              <option key={owner.value} value={owner.value}>
                {owner.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={loading}>
            Agregar
          </button>
        </form>

        <div className="list">
          {tasks.length === 0 ? (
            <p className="empty">No hay tareas para este usuario.</p>
          ) : (
            tasks.map((task) => (
              <div className="list-item" key={task.id}>
                {taskEditId === task.id ? (
                  <form className="edit-form" onSubmit={handleUpdateTask}>
                    <input
                      value={taskEditForm.title}
                      onChange={(event) =>
                        setTaskEditForm((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                    />
                    <select
                      value={taskEditForm.owner}
                      onChange={(event) =>
                        setTaskEditForm((prev) => ({
                          ...prev,
                          owner: event.target.value,
                        }))
                      }
                    >
                      {OWNER_OPTIONS.map((owner) => (
                        <option key={owner.value} value={owner.value}>
                          {owner.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={taskEditForm.status}
                      onChange={(event) =>
                        setTaskEditForm((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <div className="row-actions">
                      <button type="submit" disabled={loading}>
                        Guardar
                      </button>
                      <button type="button" onClick={cancelEditTask}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="row">
                    <div>
                      <h3>{task.title}</h3>
                      <p className="meta">
                        {task.owner} - {task.status}
                      </p>
                    </div>
                    <div className="row-actions">
                      <button type="button" onClick={() => startEditTask(task)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default App
