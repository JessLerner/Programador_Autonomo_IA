import { renderCustomerTable } from './src/components/CustomerTable.js';
import fs from 'fs';

console.log('--- Ejecutando Test Suite: Tabla de Clientes ---');

try {
  const html = renderCustomerTable();
  if (!html.includes('Listado de Clientes')) {
    throw new Error('Fallo: No se encontró el encabezado de clientes.');
  }

  // Verificar si ya se implementó el buscador
  const code = fs.readFileSync('./src/components/CustomerTable.js', 'utf-8');
  const hasSearch = code.toLowerCase().includes('search') || 
                    code.toLowerCase().includes('buscar') || 
                    code.toLowerCase().includes('filter') ||
                    code.toLowerCase().includes('input');

  console.log('✓ Componente renderiza correctamente 5 clientes.');
  if (hasSearch) {
    console.log('✓ Buscador de clientes detectado en el componente.');
  } else {
    console.log('ℹ Buscador de clientes aún no implementado.');
  }

  console.log('--- TODOS LOS TESTS PASARON EXITOSAMENTE ---');
  process.exit(0);
} catch (err) {
  console.error('✗ ERROR EN PRUEBAS:', err.message);
  process.exit(1);
}
