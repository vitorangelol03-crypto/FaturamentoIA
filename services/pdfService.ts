import { Receipt, Category } from '../types';

// Declare jsPDF types globally since we are loading from CDN
declare global {
  interface Window {
    jspdf: any;
  }
}

export const generateSingleReceiptPDF = (receipt: Receipt, categoryName: string) => {
    if (!window.jspdf) {
        alert("PDF library not loaded. Please check your internet connection.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // -- Header Style --
    doc.setFillColor(2, 132, 199); // Brand Blue
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(receipt.establishment, 14, 20); // Title
    
    doc.setFontSize(10);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    // -- Info Section --
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    
    let yPos = 55;
    
    // Left Column
    doc.setFont(undefined, 'bold');
    doc.text("Data:", 14, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR'), 40, yPos);
    
    yPos += 8;
    doc.setFont(undefined, 'bold');
    doc.text("Valor Total:", 14, yPos);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(14);
    doc.text(`R$ ${Number(receipt.total_amount).toFixed(2)}`, 40, yPos);
    doc.setFontSize(12);

    yPos += 10;
    doc.setFont(undefined, 'bold');
    doc.text("Categoria:", 14, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(categoryName, 40, yPos);

    // Right Column (offset x = 110)
    let yPosRight = 55;
    if (receipt.payment_method) {
        doc.setFont(undefined, 'bold');
        doc.text("Pagamento:", 110, yPosRight);
        doc.setFont(undefined, 'normal');
        doc.text(receipt.payment_method, 140, yPosRight);
        yPosRight += 8;
    }
    
    if (receipt.cnpj) {
        doc.setFont(undefined, 'bold');
        doc.text("CNPJ:", 110, yPosRight);
        doc.setFont(undefined, 'normal');
        doc.text(receipt.cnpj, 140, yPosRight);
    }

    yPos = Math.max(yPos, yPosRight) + 15;

    // -- Items Table (if exists) --
    if (receipt.items && receipt.items.length > 0) {
        const tableData = receipt.items.map(item => [
            item.name,
            item.quantity.toString(),
            `R$ ${item.unitPrice?.toFixed(2) || '0.00'}`,
            `R$ ${item.totalPrice?.toFixed(2) || '0.00'}`
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Item', 'Qtd', 'Unitário', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [100, 100, 100] },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
    } else {
        yPos += 10;
    }

    // -- Receipt Image --
    if (receipt.image_url) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text("Comprovante Anexo", 14, yPos);
        yPos += 5;
        
        // Add image (try to fit within page bounds)
        try {
            const imgProps = doc.getImageProperties(receipt.image_url);
            const pdfWidth = doc.internal.pageSize.getWidth() - 28;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            // If image is too tall for remaining page, add new page
            if (yPos + pdfHeight > 280) {
                doc.addPage();
                yPos = 20;
            }

            doc.addImage(receipt.image_url, 'JPEG', 14, yPos, pdfWidth, pdfHeight, undefined, 'FAST');
        } catch (e) {
            console.error("Error adding image single PDF", e);
        }
    }

    // Filename
    const cleanName = receipt.establishment.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 15);
    doc.save(`${cleanName}_${receipt.date}.pdf`);
};

export const generatePDFReport = (
  receipts: Receipt[], 
  categories: Category[], 
  startDate: string, 
  endDate: string,
  includeImages: boolean
) => {
  if (!window.jspdf) {
    alert("PDF library not loaded. Please check your internet connection.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // -- Header --
  doc.setFontSize(22);
  doc.setTextColor(0, 51, 153);
  doc.text("Relatório de Despesas", 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Período: ${startDate} a ${endDate}`, 14, 30);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);

  // -- Executive Summary --
  const totalSpent = receipts.reduce((acc, r) => acc + Number(r.total_amount), 0);
  const totalNotes = receipts.length;
  const avgTicket = totalNotes > 0 ? totalSpent / totalNotes : 0;

  doc.setFillColor(240, 249, 255);
  doc.roundedRect(14, 45, 180, 25, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text("Total Gasto", 20, 52);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`R$ ${totalSpent.toFixed(2)}`, 20, 60);

  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text("Qtd. Notas", 80, 52);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`${totalNotes}`, 80, 60);

  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text("Ticket Médio", 140, 52);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`R$ ${avgTicket.toFixed(2)}`, 140, 60);

  // -- Table --
  const tableData = receipts.map(r => {
    const catName = categories.find(c => c.id === r.category_id)?.name || 'Desconhecido';
    return [
      new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR'),
      r.establishment,
      catName,
      `R$ ${Number(r.total_amount).toFixed(2)}`
    ];
  });

  doc.autoTable({
    startY: 80,
    head: [['Data', 'Estabelecimento', 'Categoria', 'Valor']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [2, 132, 199] },
  });

  let finalY = (doc as any).lastAutoTable.finalY;

  // -- Images (Merged) --
  if (includeImages) {
    doc.addPage();
    doc.setFontSize(16);
    doc.text("Anexos - Notas Fiscais", 14, 20);
    let yPos = 30;
    
    receipts.forEach((r, index) => {
       if (r.image_url) {
           // Basic check if it fits on page, else new page
           if (yPos > 250) {
               doc.addPage();
               yPos = 20;
           }
           
           try {
               doc.setFontSize(10);
               doc.text(`Nota #${index + 1}: ${r.establishment} - ${r.date}`, 14, yPos);
               // Assuming image_url is a Base64 string from DB or cache
               // If it's a URL, jsPDF might need it converted to base64. 
               // For this demo, we assume the app stores base64 data URIs mostly.
               doc.addImage(r.image_url, 'JPEG', 14, yPos + 5, 80, 100, undefined, 'FAST'); 
               yPos += 115;
           } catch (e) {
               console.error("Error adding image to PDF", e);
               doc.text(`[Erro ao carregar imagem para Nota #${index+1}]`, 14, yPos + 10);
               yPos += 20;
           }
       }
    });
  }

  doc.save('relatorio_notas.pdf');
};