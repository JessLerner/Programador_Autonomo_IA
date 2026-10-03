import customers from '../data/customers.json' with { type: 'json' };

/**
 * Componente Tabla de Clientes
 * Renderiza la lista actual de clientes registrados en el sistema.
 */
export function renderCustomerTable() {
  return `
    <div class="customer-table-container">
      <h2>Listado de Clientes</h2>
      <table class="table-striped">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Empresa</th>
            <th>Email</th>
            <th>Estado</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(c => `
            <tr>
              <td>${c.id}</td>
              <td>${c.name}</td>
              <td>${c.company}</td>
              <td>${c.email}</td>
              <td><span class="badge ${c.status.toLowerCase()}">${c.status}</span></td>
              <td>$${c.balance.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
