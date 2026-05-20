const BASE = '/api';
export function makeApi(token) {
  const h = { 'Content-Type':'application/json', 'Authorization':'Bearer '+token };
  const req = async (method, path, body) => {
    const res = await fetch(BASE+path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
    return data;
  };
  return {
    stats:        ()        => req('GET',   '/users/stats'),
    getUsers:     ()        => req('GET',   '/users'),
    createUser:   (body)    => req('POST',  '/users', body),
    updateUser:   (id,body) => req('PATCH', '/users/'+id, body),
    deleteUser:   (id)      => req('DELETE','/users/'+id),
  };
}
