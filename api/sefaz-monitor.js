import { DistribuicaoDFe } from 'node-mde';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { action, ultNSU, chave, nsu, location } = req.body;

  const locationConfigs = {
    'Caratinga': { pfxEnv: 'PFX_CERTIFICATE', passEnv: 'PFX_PASSWORD', cnpj: '11802464000138' },
    'Ponte Nova': { pfxEnv: 'PFX_CERTIFICATE_PN', passEnv: 'PFX_PASSWORD_PN', cnpj: '53824315000110' },
  };

  const config = locationConfigs[location || 'Caratinga'];
  if (!config) {
    return res.status(400).json({ error: 'Localização inválida.' });
  }

  const pfxBase64 = process.env[config.pfxEnv];
  const pfxPassword = process.env[config.passEnv];

  if (!pfxBase64 || !pfxPassword) {
    return res.status(500).json({ error: `Certificado PFX não configurado para ${location || 'Caratinga'}.` });
  }

  try {
    const pfxBuffer = Buffer.from(pfxBase64, 'base64');

    const distribuicao = new DistribuicaoDFe({
      pfx: pfxBuffer,
      passphrase: pfxPassword,
      cnpj: config.cnpj,
      cUFAutor: '31',
      tpAmb: '1',
    });

    let result;

    if (action === 'sync') {
      result = await distribuicao.consultaUltNSU(ultNSU || '000000000000000');
    } else if (action === 'consultaChave') {
      if (!chave) {
        return res.status(400).json({ error: 'Chave de acesso não informada.' });
      }
      result = await distribuicao.consultaChNFe(chave);
    } else if (action === 'consultaNSU') {
      if (!nsu) {
        return res.status(400).json({ error: 'NSU não informado.' });
      }
      result = await distribuicao.consultaNSU(nsu);
    } else {
      return res.status(400).json({ error: 'Ação inválida.' });
    }

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    const data = result.data || result;

    return res.status(200).json({
      cStat: data.cStat,
      xMotivo: data.xMotivo,
      ultNSU: data.ultNSU,
      maxNSU: data.maxNSU,
      documents: data.docZip || [],
    });
  } catch (error) {
    console.error('SEFAZ API Error:', error);
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';

    let errorCode = 'unknown';
    let userMessage = 'Erro desconhecido ao comunicar com a SEFAZ.';

    if (code === 'ERR_OSSL_PKCS12_MAC_VERIFY_FAILURE' || msg.includes('pfx') || msg.includes('pkcs12') || msg.includes('mac verify failure') || msg.includes('bad decrypt') || msg.includes('invalid password') || msg.includes('routines:PKCS12')) {
      errorCode = 'certificate_error';
      userMessage = `Erro no certificado digital (PFX) de ${location || 'Caratinga'}. Verifique se o certificado está válido e a senha está correta.`;
    } else if (code === 'CERT_HAS_EXPIRED' || msg.includes('certificate has expired') || msg.includes('cert_has_expired') || msg.includes('certificate_expired')) {
      errorCode = 'certificate_expired';
      userMessage = `O certificado digital de ${location || 'Caratinga'} está vencido. É necessário renová-lo para continuar consultando a SEFAZ.`;
    } else if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN' || msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('getaddrinfo') || msg.includes('dns')) {
      errorCode = 'sefaz_offline';
      userMessage = 'Não foi possível conectar ao servidor da SEFAZ. O serviço pode estar fora do ar ou há um problema de rede.';
    } else if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('esockettimedout') || code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
      errorCode = 'timeout';
      userMessage = 'A SEFAZ demorou muito para responder (timeout). Tente novamente em alguns minutos.';
    } else if (code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || msg.includes('ssl') || msg.includes('tls') || msg.includes('handshake') || msg.includes('self signed') || msg.includes('unable to verify')) {
      errorCode = 'ssl_error';
      userMessage = 'Erro de segurança na conexão com a SEFAZ (SSL/TLS). O certificado pode estar incompatível.';
    } else if (code === 'ECONNRESET' || code === 'ECONNABORTED' || msg.includes('econnreset') || msg.includes('socket hang up') || msg.includes('connection reset')) {
      errorCode = 'connection_reset';
      userMessage = 'A conexão com a SEFAZ foi interrompida. Tente novamente.';
    } else if (msg.includes('unauthorized') || msg.includes('403') || msg.includes('401')) {
      errorCode = 'auth_error';
      userMessage = `Acesso negado pela SEFAZ para ${location || 'Caratinga'}. Verifique se o CNPJ e certificado estão autorizados.`;
    } else {
      userMessage = `Erro ao comunicar com a SEFAZ: ${error.message}`;
    }

    return res.status(500).json({
      error: userMessage,
      errorCode,
      details: error.message,
    });
  }
}
