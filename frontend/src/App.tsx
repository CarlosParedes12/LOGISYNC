import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowDownUp, ArrowRight, Box, CheckCircle2, ChevronDown, CircleUserRound, ClipboardList,
  Clock3, CloudOff, FilePlus2, History, LayoutDashboard, LockKeyhole, LogOut, MapPin,
  Menu, Package, PackageCheck, Plus, RefreshCcw, Search, Shield, ShieldCheck, ShieldX,
  Truck, Users, X, AlertCircle, Radio, Eye, EyeOff
} from 'lucide-react';
import { ApiError, request, type Historial, type LoginResponse, type Paquete, type Usuario } from './api';

type Page = 'inicio' | 'paquetes' | 'registrar' | 'seguimiento' | 'usuarios';
const states = ['Registrado', 'En bodega', 'En tránsito', 'En aduana', 'Entregado', 'Cancelado'];
const DATE = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (date?: string | null) => {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.valueOf()) ? '—' : DATE.format(parsed);
};
function pickList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const key of ['paquetes', 'usuarios', 'historial', 'resultados', 'data']) if (Array.isArray(d[key])) return d[key] as T[];
  }
  return [];
}
const clsStatus = (estado: string) => {
  const s = estado?.toLowerCase() ?? '';
  if (s.includes('entregado')) return 'green';
  if (s.includes('cancelado')) return 'red';
  if (s.includes('tránsito') || s.includes('transito') || s.includes('aduana')) return 'blue';
  if (s.includes('bodega')) return 'orange';
  return 'gray';
};
function Status({ estado }: { estado: string }) { return <span className={`status status-${clsStatus(estado)}`}><span className="status-dot"/>{estado}</span>; }
function Empty({ title, body }: { title: string; body: string }) {
  return <div className="empty"><Box size={36} strokeWidth={1.6}/><strong>{title}</strong><span>{body}</span></div>;
}
function Loading() { return <div className="loading"><RefreshCcw className="spin" size={20}/> Cargando datos...</div>; }
function Notice({ text, error, close }: { text: string; error?: boolean; close: () => void }) {
  return <div className={`notice ${error ? 'notice-error' : 'notice-success'}`} role="status">{error ? <AlertCircle size={19}/> : <CheckCircle2 size={19}/>}<span>{text}</span><button className="icon-btn" onClick={close} aria-label="Cerrar aviso"><X size={17}/></button></div>;
}
function Label({ children }: { children: ReactNode }) { return <label className="field-label">{children}</label>; }
function IconButton({ children, onClick, disabled=false, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; title: string }) { return <button type="button" className="icon-btn" onClick={onClick} disabled={disabled} title={title} aria-label={title}>{children}</button>; }

export default function App() {
  const [session, setSession] = useState<LoginResponse | null>(() => {
    try { const raw = sessionStorage.getItem('logisync-session'); return raw ? JSON.parse(raw) as LoginResponse : null; }
    catch { return null; }
  });
  const [page, setPage] = useState<Page>('inicio');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{text: string; error?: boolean} | null>(null);
  const [selectedGuia, setSelectedGuia] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('Todos');
  const [selectedEstado, setSelectedEstado] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [savingEstado, setSavingEstado] = useState(false);

  const token = session?.token;
  const isAdmin = session?.usuario.rol === 'administrador';
  const notify = useCallback((text: string, error = false) => setNotice({text, error}), []);
  const logout = useCallback(() => {
    sessionStorage.removeItem('logisync-session');
    setSession(null); setPage('inicio'); setPaquetes([]); setUsuarios([]); setSelectedGuia(null);
  }, []);
  const errorNotify = useCallback((err: unknown) => {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403) && (err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('inactivo') || err.message.toLowerCase().includes('sesión'))) {
      logout(); notify('Tu sesión expiró o fue desactivada. Inicia sesión de nuevo.', true);
      return;
    }
    notify(err instanceof Error ? err.message : 'Ocurrió un error inesperado.', true);
  }, [logout, notify]);
  const loadPaquetes = useCallback(async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    try { const data = await request<unknown>('/api/paquetes', token); setPaquetes(pickList<Paquete>(data)); }
    catch (e) { errorNotify(e); }
    finally { if (!quiet) setLoading(false); }
  }, [token, errorNotify]);
  const loadUsuarios = useCallback(async () => {
    if (!token || !isAdmin) return;
    try { const data = await request<unknown>('/api/usuarios', token); setUsuarios(pickList<Usuario>(data)); }
    catch (e) { errorNotify(e); }
  }, [token, isAdmin, errorNotify]);
  useEffect(() => { if (token) { void loadPaquetes(); } }, [token, loadPaquetes]);
  useEffect(() => { if (page === 'usuarios' && isAdmin) { void loadUsuarios(); } }, [page, isAdmin, loadUsuarios]);
  useEffect(() => {
    if (!selectedGuia || !token) return;
    let cancelled = false;
    setHistoryLoading(true);
    void request<unknown>(`/api/paquetes/${encodeURIComponent(selectedGuia)}/historial`, token)
      .then(data => { if (!cancelled) setHistorial(pickList<Historial>(data)); })
      .catch(e => { if (!cancelled) errorNotify(e); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedGuia, token, errorNotify]);

  const activePackage = paquetes.find(p => p.numero_guia === selectedGuia);
  const filtered = useMemo(() => paquetes.filter(p => {
    const q = search.trim().toLowerCase();
    const match = !q || [p.numero_guia, p.nombre_cliente, p.origen, p.destino, p.proveedor_logistico || ''].some(v => v?.toLowerCase().includes(q));
    return match && (estadoFilter === 'Todos' || p.estado_actual === estadoFilter);
  }), [paquetes, search, estadoFilter]);
  const stats = useMemo(() => ({
    total: paquetes.length,
    curso: paquetes.filter(p => ['En tránsito', 'En aduana', 'En bodega'].includes(p.estado_actual)).length,
    entregados: paquetes.filter(p => p.estado_actual === 'Entregado').length,
    pendientes: paquetes.filter(p => p.estado_actual === 'Registrado').length
  }), [paquetes]);

  const openPackage = (guia: string) => {
    setSelectedGuia(guia); setSelectedEstado(''); setUbicacion(''); setDescripcion(''); setHistorial([]);
  };
  const go = (p: Page) => { setPage(p); setMobileOpen(false); setNotice(null); setSelectedGuia(null); };
  const updateEstado = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!selectedGuia || !token || !selectedEstado || !ubicacion.trim()) { notify('Selecciona un estado e introduce la ubicación.', true); return; }
    setSavingEstado(true);
    try {
      await request(`/api/paquetes/${encodeURIComponent(selectedGuia)}/estado`, token, {
        method: 'PATCH', body: JSON.stringify({estado: selectedEstado, ubicacion: ubicacion.trim(), descripcion: descripcion.trim()})
      });
      notify('Estado del paquete actualizado correctamente.');
      setSelectedEstado(''); setUbicacion(''); setDescripcion('');
      await loadPaquetes(true);
      const hist = await request<unknown>(`/api/paquetes/${encodeURIComponent(selectedGuia)}/historial`, token);
      setHistorial(pickList<Historial>(hist));
    } catch (e) { errorNotify(e); } finally { setSavingEstado(false); }
  };

  if (!session) return <Login onLogin={(s) => { setSession(s); sessionStorage.setItem('logisync-session', JSON.stringify(s)); setNotice(null); }} notice={notice} dismiss={() => setNotice(null)}/>;

  const nav: {page:Page; icon: ReactNode; text:string}[] = [
    {page:'inicio', icon:<LayoutDashboard size={19}/>, text:'Dashboard'},
    {page:'paquetes', icon:<Package size={19}/>, text:'Envíos'},
    {page:'registrar', icon:<FilePlus2 size={19}/>, text:'Registrar envío'},
    {page:'seguimiento', icon:<MapPin size={19}/>, text:'Seguimiento'},
    ...(isAdmin ? [{page:'usuarios' as const, icon:<Users size={19}/>, text:'Usuarios'}] : [])
  ];

  return <div className="app-shell">
    {mobileOpen && <button className="nav-scrim" onClick={()=>setMobileOpen(false)} aria-label="Cerrar navegación"/>}
    <aside className={`sidebar ${mobileOpen ? 'show' : ''}`}>
      <div className="brand"><div className="brand-mark"><Truck size={24}/></div><div><strong>LOGISYNC</strong><small>BPGroupGT · Plataforma logística</small></div></div>
      <div className="nav-label">MENÚ PRINCIPAL</div>
      <nav>{nav.map(item=><button key={item.page} onClick={()=>go(item.page)} className={`nav-item ${page === item.page ? 'current' : ''}`}>{item.icon}{item.text}{page === item.page && <span className="nav-arrow">›</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="system-note"><ShieldCheck size={20}/><div><strong>Acceso seguro</strong><span>Sesión protegida mediante JWT</span></div></div><div className="sidebar-footer">Sistema de Gestión y Seguimiento de Envíos<br/>Proyecto académico · Versión demostrativa</div></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="left-top"><IconButton onClick={()=>setMobileOpen(true)} title="Abrir menú"><Menu size={22}/></IconButton><span className="breadcrumb">LOGISYNC <span>/</span> {nav.find(n=>n.page===page)?.text}</span></div>
        <div className="top-right"><span className="connection"><span/> Backend local</span><div className="user-badge"><CircleUserRound size={26}/><div><b>{session.usuario.nombre}</b><small>{session.usuario.rol}</small></div></div><IconButton title="Cerrar sesión" onClick={logout}><LogOut size={19}/></IconButton></div>
      </header>
      <div className="content">
        {notice && <Notice text={notice.text} error={notice.error} close={()=>setNotice(null)}/>}
        {page === 'inicio' && <>
          <div className="page-heading"><div><span className="eyebrow">CENTRO DE OPERACIONES</span><h1>Panel de control</h1><p>Vista general del estado de tus envíos y movimientos.</p></div><button className="primary-btn" onClick={()=>go('registrar')}><Plus size={17}/> Nuevo envío</button></div>
          <div className="metrics">
            <Metric label="Total de envíos" value={stats.total} icon={<Box/>} tone="blue" />
            <Metric label="En proceso" value={stats.curso} icon={<Truck/>} tone="purple" />
            <Metric label="Entregados" value={stats.entregados} icon={<PackageCheck/>} tone="green" />
            <Metric label="Registrados" value={stats.pendientes} icon={<Clock3/>} tone="orange" />
          </div>
          <div className="panel"><div className="panel-header"><div><h2>Actividad reciente</h2><p>Últimos envíos registrados en la plataforma.</p></div><button className="text-btn" onClick={()=>go('paquetes')}>Ver todos <ArrowRight size={16}/></button></div>
            {loading ? <Loading/> : paquetes.length===0 ? <Empty title="Sin envíos registrados" body="Crea tu primer envío para comenzar."/> : <PackageTable paquetes={[...paquetes].sort((a,b)=>(b.fecha_ingreso||'').localeCompare(a.fecha_ingreso||'')).slice(0,6)} onOpen={openPackage}/>}
          </div>
          <div className="feature-strip"><div><Activity size={21}/><div><b>Información centralizada</b><p>Registros y estados consultados desde PostgreSQL.</p></div></div><div><Shield size={21}/><div><b>Control de acceso</b><p>Administración protegida por rol de usuario.</p></div></div><div><History size={21}/><div><b>Trazabilidad</b><p>Historial cronológico de cambios de estado.</p></div></div></div>
        </>}
        {page === 'paquetes' && <>
          <div className="page-heading"><div><span className="eyebrow">GESTIÓN LOGÍSTICA</span><h1>Envíos registrados</h1><p>Consulta y administra los movimientos de paquetes.</p></div><button className="primary-btn" onClick={()=>go('registrar')}><Plus size={17}/> Registrar envío</button></div>
          <div className="panel"><div className="filters"><div className="searchbox"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por guía, cliente, origen..." aria-label="Buscar envíos"/></div><div className="select-wrap"><ArrowDownUp size={16}/><select value={estadoFilter} onChange={e=>setEstadoFilter(e.target.value)} aria-label="Filtrar estado"><option>Todos</option>{states.map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={15}/></div><button className="secondary-btn" onClick={()=>void loadPaquetes()}><RefreshCcw size={17}/> Actualizar</button></div>
          {loading ? <Loading/> : filtered.length === 0 ? <Empty title="No se encontraron envíos" body="Prueba otros filtros o registra un nuevo envío."/> : <PackageTable paquetes={filtered} onOpen={openPackage}/>}</div>
        </>}
        {page === 'registrar' && token && <Register token={token} onSaved={async ()=>{ await loadPaquetes(true); go('paquetes'); notify('Envío registrado correctamente.'); }} onError={errorNotify}/>}
        {page === 'seguimiento' && <>
          <div className="page-heading"><div><span className="eyebrow">TRAZABILIDAD</span><h1>Seguimiento de envíos</h1><p>Busca un número de guía y revisa los movimientos del paquete.</p></div></div>
          <div className="panel follow-panel"><div className="follow-image"><Radio size={29}/></div><h2>Consulta por número de guía</h2><p>La información proviene directamente de la base de datos de LOGISYNC.</p><form className="tracking-form" onSubmit={e=>{e.preventDefault(); if(search.trim()) openPackage(search.trim());}}><div className="searchbox"><Search size={18}/><input placeholder="Ejemplo: BP001234567" value={search} onChange={e=>setSearch(e.target.value)}/></div><button className="primary-btn" type="submit">Consultar <ArrowRight size={16}/></button></form><div className="info-line"><LockKeyhole size={16}/> Consulta disponible para usuarios autenticados.</div></div>
        </>}
        {page === 'usuarios' && isAdmin && token && <Usuarios token={token} usuarios={usuarios} reload={loadUsuarios} errorNotify={errorNotify} notify={notify}/>}
        <footer className="content-footer"><span>LOGISYNC · BPGroupGT</span><span>Prototipo académico · Los datos reflejan el backend local.</span></footer>
      </div>
    </main>
    {selectedGuia && <div className="drawer-backdrop" onClick={()=>setSelectedGuia(null)}><section className="drawer" onClick={e=>e.stopPropagation()} aria-label="Detalle de envío">
      <div className="drawer-top"><div><span className="eyebrow">DETALLE DEL ENVÍO</span><h2>{selectedGuia}</h2></div><IconButton onClick={()=>setSelectedGuia(null)} title="Cerrar detalle"><X size={21}/></IconButton></div>
      {!activePackage ? <div className="drawer-content"><Empty title="Guía no encontrada en la lista actual" body="Comprueba el número y actualiza los envíos."/></div> : <div className="drawer-content">
        <div className="drawer-status"><Status estado={activePackage.estado_actual}/><small>Actualizado: {formatDate(activePackage.ultima_actualizacion)}</small></div>
        <div className="detail-grid"><div><span>Cliente</span><b>{activePackage.nombre_cliente}</b></div><div><span>Transportista</span><b>{activePackage.proveedor_logistico || 'No indicado'}</b></div><div><span>Origen</span><b>{activePackage.origen}</b></div><div><span>Destino</span><b>{activePackage.destino}</b></div><div className="full"><span>Ubicación actual</span><b>{activePackage.ubicacion_actual || 'Sin ubicación'}</b></div></div>
        <h3 className="subsection"><History size={19}/> Historial de movimientos</h3>
        {historyLoading ? <Loading/> : historial.length===0 ? <Empty title="Sin eventos registrados" body="El historial aparecerá cuando existan cambios de estado."/> : <div className="timeline">{historial.map((h,i)=><div className="timeline-event" key={h.id || i}><div className="timeline-dot"/><div><strong>{h.estado}</strong><time>{formatDate(h.fecha_evento)}</time><p><MapPin size={14}/>{h.ubicacion || 'Ubicación no especificada'}</p>{h.descripcion && <span className="hist-note">{h.descripcion}</span>}<span className="source-note">Fuente: {h.fuente || 'sin especificar'}</span></div></div>)}</div>}
        <h3 className="subsection"><ArrowDownUp size={19}/> Actualizar estado manualmente</h3>
        <form className="form-stack" onSubmit={updateEstado}><div><Label>Nuevo estado</Label><select required value={selectedEstado} onChange={e=>setSelectedEstado(e.target.value)}><option value="">Seleccionar estado</option>{states.map(s=><option key={s}>{s}</option>)}</select></div><div><Label>Ubicación actual *</Label><input required value={ubicacion} onChange={e=>setUbicacion(e.target.value)} placeholder="Ejemplo: Bodega Guatemala"/></div><div><Label>Observaciones (opcional)</Label><textarea rows={3} value={descripcion} onChange={e=>setDescripcion(e.target.value)} placeholder="Detalle de movimiento"/></div><button className="primary-btn full-btn" type="submit" disabled={savingEstado}>{savingEstado ? 'Guardando...' : 'Guardar nuevo estado'}</button></form>
        <div className="api-pending"><CloudOff size={19}/><div><b>Actualización automática por API</b><span>Pendiente de integración y credenciales del transportista. No se presentan datos externos simulados.</span></div></div>
      </div>}
    </section></div>}
  </div>;
}

function Login({ onLogin, notice, dismiss }: { onLogin: (value: LoginResponse) => void; notice: {text:string; error?:boolean}|null; dismiss: ()=>void }) {
  const [correo, setCorreo] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { onLogin(await request<LoginResponse>('/api/auth/login', undefined, {method:'POST',body:JSON.stringify({ correo:correo.trim(), password })})); }
    catch(e) {setErr(e instanceof Error ? e.message : 'Error de autenticación');} finally {setBusy(false);}
  };
  return <div className="login-screen"><div className="login-brand-panel"><div className="login-logo"><Truck size={31}/> LOGISYNC</div><div className="login-center"><span className="login-kicker">BPGroupGT · OPERACIONES LOGÍSTICAS</span><h1>Control completo.<br/><em>Envíos visibles.</em></h1><p>Registra, consulta y realiza seguimiento a cada movimiento desde una plataforma centralizada.</p><div className="login-highlights"><div><CheckCircle2/> Seguimiento por número de guía</div><div><CheckCircle2/> Historial de movimientos</div><div><CheckCircle2/> Acceso seguro por roles</div></div></div><div className="login-bottom">Sistema de Gestión y Seguimiento de Envíos · Proyecto académico</div><span className="login-circle login-circle-a"/><span className="login-circle login-circle-b"/></div><div className="login-form-panel"><div className="login-card"><div className="small-logo"><Truck size={20}/> LOGISYNC</div><div className="login-title"><span>BIENVENIDO</span><h2>Iniciar sesión</h2><p>Accede con tus credenciales de administrador u operador.</p></div>{notice && <Notice text={notice.text} error={notice.error} close={dismiss}/>} {err && <div className="inline-error"><AlertCircle size={17}/>{err}</div>}<form onSubmit={submit} className="form-stack"><div><Label>Correo electrónico</Label><input autoFocus type="email" required autoComplete="username" value={correo} onChange={e=>setCorreo(e.target.value)} placeholder="usuario@empresa.com"/></div><div><Label>Contraseña</Label><div className="password-wrap"><input required type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Introduce tu contraseña"/><IconButton onClick={()=>setShow(!show)} title={show?'Ocultar contraseña':'Mostrar contraseña'}>{show?<EyeOff size={19}/>:<Eye size={19}/>}</IconButton></div></div><button disabled={busy} className="primary-btn full-btn" type="submit">{busy?'Verificando...':'Entrar a LOGISYNC'} <ArrowRight size={17}/></button></form><div className="login-security"><ShieldCheck size={18}/> Autenticación mediante JWT y contraseñas cifradas.</div></div></div></div>;
}
function Metric({label,value,icon,tone}:{label:string;value:number;icon:ReactNode;tone:string}) {
  return <div className="metric"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong></div><span className="metric-decoration"/></div>;
}
function PackageTable({paquetes,onOpen}:{paquetes:Paquete[];onOpen:(guia:string)=>void}) {
  return <div className="table-scroller"><table className="data-table"><thead><tr><th>NÚMERO DE GUÍA</th><th>CLIENTE</th><th>RUTA</th><th>ESTADO</th><th>ACTUALIZACIÓN</th><th></th></tr></thead><tbody>{paquetes.map(p=><tr key={p.id||p.numero_guia}><td><button className="guia-btn" onClick={()=>onOpen(p.numero_guia)}>{p.numero_guia}</button></td><td>{p.nombre_cliente}</td><td><span className="route">{p.origen} <ArrowRight size={13}/> {p.destino}</span></td><td><Status estado={p.estado_actual}/></td><td className="muted-cell">{formatDate(p.ultima_actualizacion || p.fecha_ingreso)}</td><td><button className="arrow-cell" onClick={()=>onOpen(p.numero_guia)} aria-label={`Ver ${p.numero_guia}`}><ArrowRight size={17}/></button></td></tr>)}</tbody></table></div>;
}
function Register({token,onSaved,onError}:{token:string;onSaved:()=>Promise<void>;onError:(e:unknown)=>void}) {
  const [form,setForm]=useState({numero_guia:'',nombre_cliente:'',origen:'',destino:'',proveedor_logistico:'',descripcion:''});
  const [busy,setBusy]=useState(false);
  const update=(key:keyof typeof form)=>(e:ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setForm(prev=>({...prev,[key]:e.target.value}));
  const submit=async (e:FormEvent)=>{e.preventDefault();setBusy(true);try{await request('/api/paquetes',token,{method:'POST',body:JSON.stringify({numero_guia:form.numero_guia.trim(),nombre_cliente:form.nombre_cliente.trim(),origen:form.origen.trim(),destino:form.destino.trim(),proveedor_logistico:form.proveedor_logistico.trim()||null,descripcion:form.descripcion.trim()||null})});await onSaved();setForm({numero_guia:'',nombre_cliente:'',origen:'',destino:'',proveedor_logistico:'',descripcion:''});}catch(e){onError(e);}finally{setBusy(false);}};
  return <><div className="page-heading"><div><span className="eyebrow">NUEVO REGISTRO</span><h1>Registrar envío</h1><p>Completa los datos para incorporarlo al seguimiento logístico.</p></div></div><div className="registration-layout"><div className="panel register-panel"><div className="panel-header"><div><h2>Información del paquete</h2><p>Los campos marcados con * son obligatorios.</p></div><ClipboardList size={25} className="muted-icon"/></div><form onSubmit={submit} className="register-form"><div><Label>Número de guía *</Label><input required maxLength={100} value={form.numero_guia} onChange={update('numero_guia')} placeholder="Ejemplo: BP001234568"/></div><div><Label>Nombre del cliente *</Label><input required maxLength={150} value={form.nombre_cliente} onChange={update('nombre_cliente')} placeholder="Nombre completo"/></div><div><Label>Origen *</Label><input required maxLength={150} value={form.origen} onChange={update('origen')} placeholder="Ciudad / país de origen"/></div><div><Label>Destino *</Label><input required maxLength={150} value={form.destino} onChange={update('destino')} placeholder="Ciudad / país de destino"/></div><div><Label>Proveedor logístico</Label><input maxLength={100} value={form.proveedor_logistico} onChange={update('proveedor_logistico')} placeholder="Ejemplo: DHL, FedEx"/></div><div className="span2"><Label>Observaciones</Label><textarea rows={4} value={form.descripcion} onChange={update('descripcion')} placeholder="Detalles relevantes del envío"/></div><div className="span2 form-actions"><button type="reset" className="secondary-btn" onClick={()=>setForm({numero_guia:'',nombre_cliente:'',origen:'',destino:'',proveedor_logistico:'',descripcion:''})}>Limpiar</button><button className="primary-btn" type="submit" disabled={busy}><Plus size={17}/>{busy?'Registrando...':'Registrar paquete'}</button></div></form></div><aside className="side-tip"><div className="side-tip-icon"><PackageCheck size={24}/></div><h3>¿Qué sucede al registrar?</h3><p>LOGISYNC crea el paquete en PostgreSQL y genera su primer evento en el historial con el estado «Registrado».</p><div className="tip-divider"/><h4>Buenas prácticas</h4><p>Utiliza números de guía únicos y verifica el origen y destino antes de guardar el registro.</p><div className="tip-divider"/><div className="tip-foot"><ShieldCheck size={18}/> Registro protegido por autenticación JWT.</div></aside></div></>;
}
function Usuarios({token,usuarios,reload,errorNotify,notify}:{token:string;usuarios:Usuario[];reload:()=>Promise<void>;errorNotify:(e:unknown)=>void;notify:(m:string,e?:boolean)=>void}) {
  const [nombre,setNombre]=useState('');const [correo,setCorreo]=useState('');const [password,setPassword]=useState('');const [show,setShow]=useState(false);const [busy,setBusy]=useState(false);
  const create=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{await request('/api/usuarios',token,{method:'POST',body:JSON.stringify({nombre:nombre.trim(),correo:correo.trim(),password})});setNombre('');setCorreo('');setPassword('');await reload();notify('Operador registrado correctamente.');}catch(e){errorNotify(e);}finally{setBusy(false);}};
  const toggle=async(u:Usuario)=>{if(u.rol !== 'operador')return; const verb=u.activo?'desactivar':'activar';if(!window.confirm(`¿Deseas ${verb} la cuenta de ${u.nombre}?`))return;try{await request(`/api/usuarios/${encodeURIComponent(u.id)}/activo`,token,{method:'PATCH',body:JSON.stringify({activo:!u.activo})});await reload();notify(`Operador ${u.activo?'desactivado':'activado'} correctamente.`);}catch(e){errorNotify(e);}};
  return <><div className="page-heading"><div><span className="eyebrow">CONTROL DE ACCESO</span><h1>Administración de usuarios</h1><p>Disponible exclusivamente para administradores.</p></div></div><div className="users-grid"><div className="panel"><div className="panel-header"><div><h2>Usuarios registrados</h2><p>Consulta roles y gestiona la activación de operadores.</p></div><Users size={22} className="muted-icon"/></div><div className="table-scroller"><table className="data-table"><thead><tr><th>NOMBRE</th><th>CORREO</th><th>ROL</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>{usuarios.map(u=><tr key={u.id}><td><strong>{u.nombre}</strong></td><td>{u.correo}</td><td><span className="role-tag">{u.rol}</span></td><td><span className={`status status-${u.activo?'green':'red'}`}><span className="status-dot"/>{u.activo?'Activo':'Inactivo'}</span></td><td>{u.rol === 'operador' ? <button className={`small-action ${u.activo?'danger':'positive'}`} onClick={()=>void toggle(u)}>{u.activo?<ShieldX size={15}/>:<ShieldCheck size={15}/>} {u.activo?'Desactivar':'Activar'}</button>:<span className="muted-cell">Protegido</span>}</td></tr>)}</tbody></table></div>{usuarios.length===0&&<Empty title="Sin resultados" body="Actualiza para consultar los usuarios."/>}</div><div className="panel user-create"><div className="panel-header"><div><h2>Nuevo operador</h2><p>El rol será siempre «operador».</p></div><Plus size={23} className="muted-icon"/></div><form className="form-stack" onSubmit={create}><div><Label>Nombre completo</Label><input maxLength={150} required value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre del operador"/></div><div><Label>Correo electrónico</Label><input type="email" maxLength={150} required value={correo} onChange={e=>setCorreo(e.target.value)} placeholder="correo@empresa.com"/></div><div><Label>Contraseña (mínimo 12 caracteres)</Label><div className="password-wrap"><input type={show?'text':'password'} required minLength={12} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nueva contraseña"/><IconButton title={show?'Ocultar':'Mostrar'} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</IconButton></div></div><button type="submit" disabled={busy} className="primary-btn full-btn">{busy?'Guardando...':'Crear operador'} <Plus size={17}/></button></form></div></div></>;
}
