
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.6.0
 * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
 */
Prisma.prismaVersion = {
  client: "6.6.0",
  engine: "f676762280b54cd07c770017ed3711ddde35f37a"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.PlantioTipoScalarFieldEnum = {
  id: 'id',
  nome: 'nome',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.SafraScalarFieldEnum = {
  id: 'id',
  safra: 'safra',
  plantio: 'plantio',
  data_referencia: 'data_referencia',
  area_ha: 'area_ha',
  painel: 'painel',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.TalhaoScalarFieldEnum = {
  id: 'id',
  codigo: 'codigo',
  local: 'local',
  nome: 'nome',
  situacao: 'situacao',
  hectares: 'hectares',
  posse: 'posse',
  contrato: 'contrato',
  observacoes: 'observacoes',
  irrigacao: 'irrigacao',
  foto_url: 'foto_url',
  maps_url: 'maps_url',
  tipo_solo: 'tipo_solo',
  calagem: 'calagem',
  gessagem: 'gessagem',
  fosforo_corretivo: 'fosforo_corretivo',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.DestinoScalarFieldEnum = {
  id: 'id',
  codigo: 'codigo',
  local: 'local',
  maps_url: 'maps_url',
  trava_sacas: 'trava_sacas',
  distancia_km: 'distancia_km',
  observacoes: 'observacoes',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.MotoristaScalarFieldEnum = {
  id: 'id',
  nome: 'nome',
  placa: 'placa',
  cpf: 'cpf',
  banco: 'banco',
  pix_conta: 'pix_conta',
  tipo_veiculo: 'tipo_veiculo',
  capacidade_kg: 'capacidade_kg',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.FreteScalarFieldEnum = {
  id: 'id',
  safra_id: 'safra_id',
  motorista_id: 'motorista_id',
  destino_id: 'destino_id',
  valor_por_saca: 'valor_por_saca',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.DestinoRegraScalarFieldEnum = {
  id: 'id',
  safra_id: 'safra_id',
  destino_id: 'destino_id',
  trava_sacas: 'trava_sacas',
  custo_silo_por_saca: 'custo_silo_por_saca',
  custo_terceiros_por_saca: 'custo_terceiros_por_saca',
  impureza_limite_pct: 'impureza_limite_pct',
  ardidos_limite_pct: 'ardidos_limite_pct',
  queimados_limite_pct: 'queimados_limite_pct',
  avariados_limite_pct: 'avariados_limite_pct',
  esverdiados_limite_pct: 'esverdiados_limite_pct',
  quebrados_limite_pct: 'quebrados_limite_pct',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.DestinoRegraPlantioScalarFieldEnum = {
  id: 'id',
  safra_id: 'safra_id',
  destino_id: 'destino_id',
  tipo_plantio: 'tipo_plantio',
  trava_sacas: 'trava_sacas',
  custo_silo_por_saca: 'custo_silo_por_saca',
  custo_terceiros_por_saca: 'custo_terceiros_por_saca',
  impureza_limite_pct: 'impureza_limite_pct',
  ardidos_limite_pct: 'ardidos_limite_pct',
  queimados_limite_pct: 'queimados_limite_pct',
  avariados_limite_pct: 'avariados_limite_pct',
  esverdiados_limite_pct: 'esverdiados_limite_pct',
  quebrados_limite_pct: 'quebrados_limite_pct',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.UmidadeFaixaPlantioScalarFieldEnum = {
  id: 'id',
  destino_regra_plantio_id: 'destino_regra_plantio_id',
  umid_gt: 'umid_gt',
  umid_lte: 'umid_lte',
  desconto_pct: 'desconto_pct',
  custo_secagem_por_saca: 'custo_secagem_por_saca',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.UmidadeFaixaScalarFieldEnum = {
  id: 'id',
  destino_regra_id: 'destino_regra_id',
  umid_gt: 'umid_gt',
  umid_lte: 'umid_lte',
  desconto_pct: 'desconto_pct',
  custo_secagem_por_saca: 'custo_secagem_por_saca',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.TalhaoSafraScalarFieldEnum = {
  id: 'id',
  safra_id: 'safra_id',
  talhao_id: 'talhao_id',
  pct_area_colhida: 'pct_area_colhida',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ViagemScalarFieldEnum = {
  id: 'id',
  ficha: 'ficha',
  safra_id: 'safra_id',
  tipo_plantio: 'tipo_plantio',
  talhao_id: 'talhao_id',
  local: 'local',
  destino_id: 'destino_id',
  motorista_id: 'motorista_id',
  placa: 'placa',
  data_saida: 'data_saida',
  hora_saida: 'hora_saida',
  data_entrega: 'data_entrega',
  hora_entrega: 'hora_entrega',
  carga_total_kg: 'carga_total_kg',
  tara_kg: 'tara_kg',
  umidade_pct: 'umidade_pct',
  impureza_pct: 'impureza_pct',
  ardidos_pct: 'ardidos_pct',
  queimados_pct: 'queimados_pct',
  avariados_pct: 'avariados_pct',
  esverdiados_pct: 'esverdiados_pct',
  quebrados_pct: 'quebrados_pct',
  impureza_limite_pct: 'impureza_limite_pct',
  ardidos_limite_pct: 'ardidos_limite_pct',
  queimados_limite_pct: 'queimados_limite_pct',
  avariados_limite_pct: 'avariados_limite_pct',
  esverdiados_limite_pct: 'esverdiados_limite_pct',
  quebrados_limite_pct: 'quebrados_limite_pct',
  peso_bruto_kg: 'peso_bruto_kg',
  umidade_desc_pct: 'umidade_desc_pct',
  umidade_desc_pct_manual: 'umidade_desc_pct_manual',
  umidade_kg: 'umidade_kg',
  impureza_kg: 'impureza_kg',
  ardidos_kg: 'ardidos_kg',
  queimados_kg: 'queimados_kg',
  avariados_kg: 'avariados_kg',
  esverdiados_kg: 'esverdiados_kg',
  quebrados_kg: 'quebrados_kg',
  peso_limpo_seco_kg: 'peso_limpo_seco_kg',
  sacas: 'sacas',
  sacas_frete: 'sacas_frete',
  frete_tabela: 'frete_tabela',
  sub_total_frete: 'sub_total_frete',
  secagem_custo_por_saca: 'secagem_custo_por_saca',
  sub_total_secagem: 'sub_total_secagem',
  custo_silo_por_saca: 'custo_silo_por_saca',
  sub_total_custo_silo: 'sub_total_custo_silo',
  abatimento_total_silo: 'abatimento_total_silo',
  abatimento_por_saca_silo: 'abatimento_por_saca_silo',
  custo_terceiros_por_saca: 'custo_terceiros_por_saca',
  sub_total_custo_terceiros: 'sub_total_custo_terceiros',
  abatimento_total_terceiros: 'abatimento_total_terceiros',
  abatimento_por_saca_terceiros: 'abatimento_por_saca_terceiros',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.MotoristaQuitacaoScalarFieldEnum = {
  id: 'id',
  motorista_id: 'motorista_id',
  de: 'de',
  ate: 'ate',
  data_pagamento: 'data_pagamento',
  valor: 'valor',
  forma_pagamento: 'forma_pagamento',
  observacoes: 'observacoes',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.UsuarioScalarFieldEnum = {
  id: 'id',
  username: 'username',
  nome: 'nome',
  role: 'role',
  motorista_id: 'motorista_id',
  menus_json: 'menus_json',
  password_hash: 'password_hash',
  password_salt: 'password_salt',
  active: 'active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.UsuarioSessaoScalarFieldEnum = {
  id: 'id',
  usuario_id: 'usuario_id',
  token_hash: 'token_hash',
  expires_at: 'expires_at',
  created_at: 'created_at'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  PlantioTipo: 'PlantioTipo',
  Safra: 'Safra',
  Talhao: 'Talhao',
  Destino: 'Destino',
  Motorista: 'Motorista',
  Frete: 'Frete',
  DestinoRegra: 'DestinoRegra',
  DestinoRegraPlantio: 'DestinoRegraPlantio',
  UmidadeFaixaPlantio: 'UmidadeFaixaPlantio',
  UmidadeFaixa: 'UmidadeFaixa',
  TalhaoSafra: 'TalhaoSafra',
  Viagem: 'Viagem',
  MotoristaQuitacao: 'MotoristaQuitacao',
  Usuario: 'Usuario',
  UsuarioSessao: 'UsuarioSessao'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }

        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
