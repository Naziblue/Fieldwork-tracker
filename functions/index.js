const functions = require('firebase-functions');
const fetch = require('node-fetch');
const { PDFDocument } = require('pdf-lib');

const BACB_PDF_URL = 'https://www.bacb.com/wp-content/uploads/2025/03/2027-Monthly-Fieldwork-Verification-Form-Individual_260213-2-a.pdf';

exports.fillBACBForm = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  try {
    const {
      traineeName,
      bacbId,
      monthYear,
      state,
      country,
      supervisorName,
      supervisorCert,
      independentHours,
      independentMinutes,
      supervisedHours,
      supervisedMinutes,
      observationMinutes,
      totalHours,
      totalMinutes,
      supervisionPercentage,
      individualSupervision,
      groupSupervision
    } = data;

    // Fetch the BACB PDF from bacb.com (server-side, no CORS issues)
    console.log('Fetching BACB PDF from:', BACB_PDF_URL);
    const pdfResponse = await fetch(BACB_PDF_URL);

    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch BACB PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    console.log('PDF fetched successfully, size:', pdfArrayBuffer.byteLength);

    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    const form = pdfDoc.getForm();

    // Log available fields for debugging
    const allFields = form.getFields();
    const fieldNames = allFields.map(f => f.getName());
    console.log('Available PDF fields:', fieldNames);

    // Map our data to PDF form fields
    const fieldMapping = {
      // Try common field names
      'Trainee Name': traineeName || '',
      'TraineeName': traineeName || '',
      'trainee.name': traineeName || '',

      'BACB ID': bacbId || '',
      'BACBID': bacbId || '',
      'BACB ID #': bacbId || '',
      'bacbId': bacbId || '',

      'Month/Year': monthYear || '',
      'MonthYear': monthYear || '',
      'Month Year': monthYear || '',

      'State': state || '',
      'State Where Fieldwork Occurred': state || '',

      'Country': country || '',
      'Country Where Fieldwork Occurred': country || '',

      'Supervisor Name': supervisorName || '',
      'SupervisorName': supervisorName || '',
      'Supervisor': supervisorName || '',

      'Certification': supervisorCert || '',
      'CertificationNumber': supervisorCert || '',
      'Certification # or BACB ID': supervisorCert || '',

      'Independent Hours': independentHours || '',
      'IndependentHours': independentHours || '',
      'A. Independent Hours': independentHours || '',

      'Independent Minutes': independentMinutes || '',
      'IndependentMinutes': independentMinutes || '',

      'Supervised Hours': supervisedHours || '',
      'SupervisedHours': supervisedHours || '',
      'B. Supervised Hours': supervisedHours || '',

      'Supervised Minutes': supervisedMinutes || '',
      'SupervisedMinutes': supervisedMinutes || '',

      'Observation Minutes': observationMinutes || '',
      'ObservationMinutes': observationMinutes || '',

      'Total Hours': totalHours || '',
      'TotalHours': totalHours || '',
      'Total Fieldwork Hours': totalHours || '',

      'Total Minutes': totalMinutes || '',
      'TotalMinutes': totalMinutes || '',

      'Percentage Supervised': supervisionPercentage || '',
      'PercentageSupervised': supervisionPercentage || '',
      'Percentage of Hours Supervised': supervisionPercentage || '',

      'Individual Supervision': individualSupervision || '',
      'IndividualSupervision': individualSupervision || '',
      'Individual Supervision Hours': individualSupervision || '',

      'Group Supervision': groupSupervision || '',
      'GroupSupervision': groupSupervision || '',
      'Group Supervision Hours': groupSupervision || ''
    };

    // Attempt to fill fields
    let filledCount = 0;
    for (const [fieldName, value] of Object.entries(fieldMapping)) {
      try {
        const field = form.getFieldMaybe(fieldName);
        if (field && value) {
          field.setText(String(value));
          filledCount++;
          console.log(`✓ Filled field: ${fieldName} = ${value}`);
        }
      } catch (e) {
        // Silent fail for fields that don't exist
        console.log(`✗ Could not fill field: ${fieldName}`);
      }
    }

    console.log(`Successfully filled ${filledCount} form fields`);

    // Save filled PDF to bytes
    const pdfBytes = await pdfDoc.save();

    // Return as base64 so it can be sent over HTTP
    return {
      success: true,
      pdfBase64: Buffer.from(pdfBytes).toString('base64'),
      fieldsFilled: filledCount,
      totalFields: fieldNames.length
    };
  } catch (error) {
    console.error('Error filling BACB form:', error);
    throw new functions.https.HttpsError('internal', `Failed to fill BACB form: ${error.message}`);
  }
});
