VALID_PRODUCT_ENTRIES = [
  {
    Article: {
        name: 'Supergood crisp yoghurt',
        barcode: '0704679371330',
        __photo: nil,
        __barcode_image_name: 'barcode0',
        __exists_on_remote: :testing,
    },
    description: 'delicous',
    amount: 3,
    expiration_date: Time.new(2016, 7, 1),
  },
  {
    Article: {
        name: 'Pumpkin',
        barcode: nil,
        __photo: nil,
        __barcode_image_name: nil,
        __exists_on_remote: false,
    },
    description: 'big and orange',
    amount: 2,
    expiration_date: Time.new(2016, 12, 4),
  },
  {
    Article: {
        name: 'Garlic',
        barcode: '0704479271230',
        __photo: 'garlic',
        __barcode_image_name: nil,
        __exists_on_remote: false,
    },
    description: 'small and white',
    amount: 1,
    expiration_date: Time.new(2016, 12, 2),
  },
  {
    Article: {
        name: 'Superfat Butter',
        barcode: '4017170008725',
        __photo: nil,
        __barcode_image_name: 'barcode1',
        __exists_on_remote: :testing,
    },
    description: 'awesome fat',
    amount: 2,
    expiration_date: Time.new(2017, 7, 1),
  },
  {
    Article: {
        name: 'Hard as Iron Muesli',
        barcode: '7610848570554',
        __photo: nil,
        __barcode_image_name: 'barcode2',
        __exists_on_remote: :testing,
    },
    description: 'it will crunch',
    amount: 4,
    expiration_date: Time.new(2016, 1, 31),
  },
]

SAVING_TIMEOUT = 2
SEVERAL_AMOUNT = 3

Before do |scenario|
  @entryHelper = CucumberExpirySyncHelpers::ProductEntryHelper.new(self)
end

Before('@emulated_camera') do |scenario|
  @entryHelper.webcam_show_img!('blank')
end

After('@emulated_camera') do |scenario|
  @entryHelper.stop_webcam_emulation!
end

When /^I open the add product screen$/ do
  tap_when_element_exists("* id:'action_add_product'")
end

When /^I choose to scan another barcode$/ do
  tap_mark("scan_barcode_btn")
end

Then /^barcode scanning should start(?: automatically)?$/ do
  wait_for_element_exists("* marked:'Enter manually'")
end

When /^I hold (a|another) valid barcode(, that is different from the original product entry's article,| of an article, that has a different name than those added before,| of an article, that has a different expiration date than those added before,)? in front of the camera$/ do |specifier1, specifier2|
  used_up_entries_hash = begin
    @entryHelper.recall('entries, whose barcodes were held in front of the camera')
  rescue RSpec::Expectations::ExpectationNotMetError => e
    {}
  end
  
  specifier2 ||= " "
  specifier2 = specifier2.lstrip
  specifier1 = "another" if specifier2 == ", that is different from the original product entry's article,"
    
  key = -1
  valid_entry = VALID_PRODUCT_ENTRIES.find do |entry|
    key += 1
    next false if entry[:Article][:__barcode_image_name].nil?
    next false if specifier1 == "another" and used_up_entries_hash.has_key?(key)
    next false if specifier2 == "of an article, that has a different name than those added before," \
      and not (used_up_entries_hash.find {|i, used_up_entry| used_up_entry[:Article][:name] == entry[:Article][:name]}).nil?
    next false if specifier2 == "of an article, that has a different expiration date than those added before," \
      and not (used_up_entries_hash.find {|i, used_up_entry| used_up_entry[:expiration_date] == entry[:expiration_date]}).nil?

    true
  end
  
  pending "No matching valid product entry samples left" if valid_entry.nil?
  
  valid_entry = valid_entry.deep_dup
  valid_entry[:__scanned_at] = Time.now
  used_up_entries_hash[key] = valid_entry
  
  @entryHelper.webcam_show_img!(valid_entry[:Article][:__barcode_image_name])
  @entryHelper.memorize(used_up_entries_hash, 'entries, whose barcodes were held in front of the camera')
  @entryHelper.memorize valid_entry[:Article][:barcode], 'this barcode'
end

When(/^I hold the barcode of the article, that had been added on the first device, in front of the camera$/) do
  barcode = @entryHelper.recall('this barcode')
  entry = VALID_PRODUCT_ENTRIES.find { |entry|  entry[:Article][:barcode] == barcode and not entry[:Article][:__barcode_image_name].nil? }
  @entryHelper.webcam_show_img!(entry[:Article][:__barcode_image_name])
end

When /^I choose to enter the product entry manually$/ do
  tap_mark("Enter manually")
end

Then /^barcode scanning should stop$/ do
  wait_for_element_does_not_exist("* marked:'Enter manually'")
  @entryHelper.webcam_show_img!('blank') # implicit: stop holding the barcode in front of the camera
end

Then /^this barcode should appear in the barcode field$/ do
  step('loading has finished')
  
  this_barcode = @entryHelper.recall('this barcode')
  barcode_field = query("* id:'barcode_field'").first
  expect(barcode_field['text']).to eq(this_barcode)
end

Then(/^the barcode field should still be empty$/) do
  barcode_field = query("* id:'barcode_field'").first
  expect(barcode_field['text']).to be_empty
end


Then /^the matching article's name should appear in the name field$/ do
  this_barcode = @entryHelper.recall('this barcode')
  matching_entry = (VALID_PRODUCT_ENTRIES.find {|entry| entry[:Article][:barcode] == this_barcode}).deep_dup
  article_name_field = query("* id:'product_name_field'").first
  expect(article_name_field['text']).to eq(matching_entry[:Article][:name])
    
  @entryHelper.memorize matching_entry, 'the product entry'
end

When /^I (supply|complement the form with) valid product entry data( without a barcode| including a barcode| with a photo| without a name| with an invalid amount)?$/ do |mode_str, containing_str|
  containing_str = containing_str.lstrip unless containing_str.nil?
  entry = nil
  if mode_str == 'supply'
    # select an entry from the list of prepared samples that matches containing_str:
    entry = VALID_PRODUCT_ENTRIES.find do |entry| 
      # we might choose any really, but out of a whim, let's choose ones that don't exist on any of the remotes:
      next false if entry[:Article][:__exists_on_remote]
        
      case containing_str
      when 'including a barcode'
        not entry[:Article][:barcode].nil?
      when 'without a barcode' 
        entry[:Article][:barcode].nil?
      when 'with a photo'
        not entry[:Article][:__photo].nil?
      else
        true
      end
    end.deep_dup
    
    # set fields to erroneous states, if required:
    case containing_str
    when 'without a name'
      entry[:Article][:name] = ''
    when 'with an invalid amount'
      entry[:amount] = 0
    end
    
    # enter the entry's barcode into the form if any
    unless entry[:Article][:barcode].nil?
      enter_text("* id:'barcode_field'", entry[:Article][:barcode])
      ExpirySyncUtility.scroll_down_to("* id:'product_name_field'")
      tap_mark("product_name_field")
      step('loading has finished')
    end
    
    ExpirySyncUtility.scroll_down_to("* id:'product_name_field'")
    enter_text("* id:'product_name_field'", entry[:Article][:name])
  else
    # just remember the entry we're going to complement
    entry = @entryHelper.recall('the product entry')
    # set fields to erroneous states, if required:
    case containing_str
    when 'without a name'
      entry[:Article][:name] = ''
    when 'with an invalid amount'
      entry[:amount] =  0
    end
  end
  
  #remember the entry we're going to use for future steps:
  @entryHelper.memorize entry, 'the product entry'
  
  # fill in the (rest of the) fields:
  ExpirySyncUtility.scroll_down_to("* id:'expiration_date_field'")
  query("* id:'expiration_date_field'", {
    method_name: :updateDate, 
    arguments: [
      entry[:expiration_date].year, 
      entry[:expiration_date].month - 1, # method requires zero-based months
      entry[:expiration_date].day
    ]
  })
  
  ExpirySyncUtility.scroll_down_to("* id:'amount_field'")
  enter_text("* id:'amount_field'", entry[:amount]) 
  
  ExpirySyncUtility.scroll_down_to("* id:'product_description_field'")
  enter_text("* id:'product_description_field'", entry[:description])
    
  unless entry[:Article][:__photo].nil?
    @entryHelper.webcam_show_img!(entry[:Article][:__photo])
    ExpirySyncUtility.scroll_down_to("* id:'product_photo_btn'")
    tap_when_element_exists("* id:'product_photo_btn'")
    
    # When we try to access the Camera activity using calabash's built in functions
    # we get a java SecurityException (because this is no longer part of our app
    # somehow)
    # So I'll use this workaround:
    sleep 1
    `#{default_device.adb_command} shell input keyevent 27`
    
    dumpsys_str = `#{default_device.adb_command} shell dumpsys window`
    md = dumpsys_str.match(/mUnrestrictedScreen=\(0,0\) ([0-9]+)x([0-9]+)/)
    
    coordinates_str = (md[1].to_f * 0.84375).to_i.to_s + " " + (md[2].to_f * 0.78125).to_i.to_s
    `#{default_device.adb_command} shell input tap #{coordinates_str}`
  end
end

When /^I overwrite the form fields contents with (?:valid but )?changed product entry data( without a name| with an invalid amount)?$/ do |containing_str|
  containing_str = containing_str.lstrip unless containing_str.nil?
  originalEntry = @entryHelper.recall('the product entry')
  entry = VALID_PRODUCT_ENTRIES.find do |entry| 
    # choose the first entry that seems to be different (yes in fact this is going to be an entirely differet article, but after all all the fields could change):
    originalEntry[:Article][:barcode] != entry[:Article][:barcode] and \
      originalEntry[:Article][:name] != entry[:Article][:name]
  end.deep_dup
  
  case containing_str
  when 'without a name'
    entry[:Article][:name] = ''
  when 'with an invalid amount'
    entry[:amount] = 0
  end
  
  ExpirySyncUtility.overwrite_text("* id:'product_name_field'", entry[:Article][:name])
  ExpirySyncUtility.scroll_to("* id:'expiration_date_field'")
  query("* id:'expiration_date_field'", {
    method_name: :updateDate, 
    arguments: [
      entry[:expiration_date].year, 
      entry[:expiration_date].month - 1, # method requires zero-based months
      entry[:expiration_date].day
    ]
  }) unless entry[:expiration_date].nil?
  ExpirySyncUtility.overwrite_text("* id:'amount_field'", entry[:amount]) unless entry[:amount].nil?
  ExpirySyncUtility.overwrite_text("* id:'product_description_field'", entry[:description]) unless entry[:description].nil?
    
  unless entry[:Article][:__photo].nil?
    @entryHelper.webcam_show_img!(entry[:Article][:__photo])
    ExpirySyncUtility.scroll_down_to("* id:'product_photo_btn'")
    tap_when_element_exists("* id:'product_photo_btn'")
    
    # When we try to access the Camera activity using calabash's built in functions
    # we get a java SecurityException (because this is no longer part of our app
    # somehow)
    # So I'll use this workaround:
    `#{default_device.adb_command} shell input keyevent 27`
    
    dumpsys_str = `#{default_device.adb_command} shell dumpsys window`
    md = dumpsys_str.match(/mUnrestrictedScreen=\(0,0\) ([0-9]+)x([0-9]+)/)
    
    coordinates_str = (md[1].to_f * 0.84375).to_i.to_s + " " + (md[2].to_f * 0.78125).to_i.to_s
    `#{default_device.adb_command} shell input tap #{coordinates_str}`
  end
  @entryHelper.memorize entry, 'the product entry'
end

When /^I try to save the product entry form$/ do
  on_edit_screen = begin
    @entryHelper.recall('opened the edit product screen')
  rescue RSpec::Expectations::ExpectationNotMetError => e
    false
  end
  
  @entryHelper.memorize(@entryHelper.recall('the product entry'), 'the updated product entry') if on_edit_screen
   
  tap_mark("Save")
  
  # now wait for loader or failure message to appear (don't bitch if it never appears - it might be to fast to 'see'):  
  time_passed = 0
  while time_passed <= SAVING_TIMEOUT \
      and !element_exists("* {text CONTAINS[c] 'Loading'}") \
      and !element_exists("* text:'Saving the product entry failed'")
    sleep 0.1
    time_passed += 0.1
  end
  
  # ...and - in the case of the loader - to disappear again: 
  wait_for_text_to_disappear("Loading") if element_exists("* {text CONTAINS[c] 'Loading'}")
  
  @entryHelper.forget('opened the edit product screen') if on_edit_screen
end

Then /I should see that (?:adding|updating) failed$/ do
  step('I should see "Saving the product entry failed"')
end

Then /^I should (no longer |still )?see (the|that|both)( updated| deleted)? product entr(?:y's|ies') (data|article name) in the product entry list$/ do |modifier, specifier, modified_how, what|
  unless specifier == 'both'
    entry = @entryHelper.recall case modified_how
    when ' updated'
      'the updated product entry'
    when ' deleted'
      'the deleted product entry'
    when nil
      'the product entry'
    end
    entries_arr = [entry]
  else
    entries_arr = @entryHelper.recall('entries, whose barcodes were held in front of the camera').values
  end
  
  entries_arr.each do |entry|
    if what == 'data'
      query_str = "* marked:'#{entry[:amount]}x #{entry[:Article][:name]}' " \
        "sibling * marked:'Expiration date: " + entry[:expiration_date].strftime('%-m/%-d/%y') + "'"
    else
      query_str = "* {text CONTAINS '#{entry[:Article][:name]}'}"
    end
    
    scroll_error = nil
    begin
      ExpirySyncUtility.scroll_to(query_str, 'ListView')
    rescue RSpec::Expectations::ExpectationNotMetError => e
      scroll_error = e
    end
    
    unless modifier == 'no longer '
      expect(scroll_error).to be_nil, "entry \"#{query_str}\" not in list"
    else
      expect(scroll_error).not_to be_nil, "entry \"#{query_str}\" still in list"
    end
  end
end

When /^I successfully add (a|another) product entry(, that has a different expiration date than those added before|, that has a different name than those added before)?$/ do |specifier1, specifier2|
  step('I open the add product screen')
  step('barcode scanning should start automatically')
  step("I hold #{specifier1} valid barcode"+ (specifier2.nil? ? '' : " of an article#{specifier2},") +" in front of the camera")
  step('barcode scanning should stop')
  step('this barcode should appear in the barcode field')
  step("the matching article's name should appear in the name field")
  step('I complement the form with valid product entry data')
  step('I try to save the product entry form')
  step("I should see the product entry's data in the product entry list")
end

When /^I try to change the product entry's data$/ do
  step('I open the edit product screen for that product entry')
  step('I overwrite the form fields contents with valid but changed product entry data')
  step('I try to save the product entry form')
  step("I should see the updated product entry's data in the product entry list")
end

Given /^there exist(?:s)? (a|several) product entr(?:y|ies)( with different expiration dates| with different names)?$/ do |quantifier, specifier|
  if quantifier == 'a'
    step("I successfully add a product entry#{specifier}")
    next 
  end
  
  specifier ||= " "
  specifier = specifier.lstrip
  specifier = case specifier
  when 'with different expiration dates'
    ', that has a different expiration date than those added before'
  when 'with different names'
    ', that has a different name than those added before'
  end
  
  SEVERAL_AMOUNT.times do
    step("I successfully add another product entry#{specifier}")
  end
  
  added_entries_hash = @entryHelper.recall('entries, whose barcodes were held in front of the camera')
  @entryHelper.memorize(added_entries_hash, ['previously added product entries', 'these product entries'])
end

When /^I open the edit product screen for that product entry$/ do
  @entryHelper.memorize(true, 'opened the edit product screen')
  entry = @entryHelper.recall('the product entry')
  
  expiration_date_query_str = "* marked:'#{entry[:amount]}x #{entry[:Article][:name]}' " \
    "sibling * marked:'Expiration date: " + entry[:expiration_date].strftime('%-m/%-d/%y') + "'"
  ExpirySyncUtility.scroll_down_to(expiration_date_query_str)
  
  tap_when_element_exists(expiration_date_query_str)
  wait_for_element_exists("* id:'barcode_field'")
end

Then /^I should see that product entry's data in the form fields$/ do
  entry = @entryHelper.recall('the product entry')
  
  wait_for_element_exists("* id:'barcode_field'")
  
  barcode_field = query("* id:'barcode_field'").first
  expect(barcode_field['text']).to eq(entry[:Article][:barcode].nil? ? "" : entry[:Article][:barcode])
    
  ExpirySyncUtility.scroll_down_to("* id:'product_name_field'")
  product_name_field = query("* id:'product_name_field'").first
  expect(product_name_field['text']).to eq(entry[:Article][:name].nil? ? "" : entry[:Article][:name])
    
  #TODO
end

When /^I choose to sort (by expiration date|alphabetically|by date of adding)$/ do |sorting_str|
  step('I press "Entry sorting" in the main menu')
  
  sorting_str = case sorting_str
  when 'by expiration date'
    'expiration date'
  when 'by date of adding'
    'last added'
  else
    sorting_str
  end
  
  tap_mark(sorting_str)
end

Then /^I should see the previously added product entries (ordered by their expiration dates|ordered alphabetically by their names|in the order in which they were added)$/ do |sorting_str|
  added_entries_hash = @entryHelper.recall('previously added product entries')
  
  expected_sorting_arr = added_entries_hash.sort do |arr1, arr2|
    entry1 = arr1[1]
    entry2 = arr2[1]
    
    case sorting_str
    when 'ordered by their expiration dates'
      entry1[:expiration_date] <=> entry2[:expiration_date]
    when 'ordered alphabetically by their names'
      entry1[:Article][:name] <=> entry2[:Article][:name]
    when 'in the order in which they were added'
      entry2[:__scanned_at] <=> entry1[:__scanned_at]
    end
  end
  
  previousY = 0
  expected_sorting_arr.each do |val_arr|
    entry = val_arr[1]
    queryResult = query("* marked:'#{entry[:amount]}x #{entry[:Article][:name]}' " \
      "sibling * marked:'Expiration date: " + entry[:expiration_date].strftime('%-m/%-d/%y') + "' parent LinearLayout")
    expect(queryResult.length).to be > 1, "entry not in list"
    
    linearLayout = queryResult[1]
    expect(linearLayout["rect"]["y"]).to be > previousY, "invalid sorting"
    
    previousY = linearLayout["rect"]["y"]
  end
end

When /^I enter the (name|barcode) of one of these product entries in the filter field$/ do |what_to_add|
  added_entries_hash = @entryHelper.recall('these product entries')
  entry = added_entries_hash.values[Random.new.rand(added_entries_hash.values.length - 1)]
  enter_text("* id:'search_field'", what_to_add == 'name' ? entry[:Article][:name] : entry[:Article][:barcode])
    
  @entryHelper.memorize(entry, 'that product entry')  
end

When /^I enter a name of a product entry different from those just added in the filter field$/ do
  added_entries_hash = @entryHelper.recall('these product entries')
  entry = VALID_PRODUCT_ENTRIES.find do |entry|
    next false if entry[:Article][:name].nil?
    added_entries_hash.values.each do |added_entry|
      break false if entry[:Article][:name].include?(added_entry[:Article][:name])
      true
    end
  end
  
  pending "No matching valid product entry samples left" if entry.nil?
  
  enter_text("* id:'search_field'", entry[:Article][:name])
end

Then /^I should see that product entry in the list \(alongside with other product entries that might contain that name in their names\)$/ do
  that_entry = @entryHelper.recall('that product entry')
  added_entries_hash = @entryHelper.recall('these product entries')
  
  added_entries_hash.values.each do |entry|
    queryResult = query("* marked:'#{entry[:amount]}x #{entry[:Article][:name]}' " \
      "sibling * marked:'Expiration date: " + entry[:expiration_date].strftime('%-m/%-d/%y') + "'")
    
    if entry[:Article][:name].downcase.include?(that_entry[:Article][:name].downcase)
      expect(queryResult.length).to be == 1, "entry not in list"
    else 
      expect(queryResult.length).to be == 0, "entry in list"
    end
  end
end

Then /^I should see only that product entry in the list$/ do
  entry = @entryHelper.recall('that product entry')
  queryResult = query("* marked:'#{entry[:amount]}x #{entry[:Article][:name]}' " \
    "sibling * marked:'Expiration date: " + entry[:expiration_date].strftime('%-m/%-d/%y') + "'")
  expect(queryResult.length).to be == 1, "entry not in list"
    
  queryResult = query("* {text CONTAINS[c] 'Expiration date:'}")
  expect(queryResult.length).to be == 1, "other entries in list"
end

Then /^the list should be empty$/ do
  queryResult = query("* {text CONTAINS[c] 'Expiration date:'}")
  expect(queryResult.length).to be == 0, "entries in list"
end

When /^I press the delete button$/ do
  press_menu_button
  tap_when_element_exists("DropDownListView * text:'Delete product'")
end

Then /^I should be asked, if I really want to delete the entry$/ do
  wait_for_element_exists("* text:'Are you sure you wish to delete this product?'")
end

When /^I answer yes$/ do
  tap_when_element_exists("* text:'yes'")
end

Then /^I should see that deleting succeeded$/ do
  # Currently no message is shown
end

Then /^the product entry should no longer be in the list$/ do
  step('the main screen is active')
  
  entry = @entryHelper.recall('the product entry')
   
  queryResult = query("* marked:'#{entry[:amount]}x #{entry[:Article][:name]}' " \
     "sibling * marked:'Expiration date: " + entry[:expiration_date].strftime('%-m/%-d/%y') + "'")
  expect(queryResult.length).to be == 0, "entry in list"
end

When /^I check a subset of these product entries$/ do
  added_entries_hash = @entryHelper.recall('these product entries')
  
  amount_to_delete = (added_entries_hash.values.length / 2.to_f).ceil # delete half of the added entries (rounding up)
  
  entries_to_delete_arr = {}
  amount_to_delete.times do
    while true
      key = Random.new.rand(added_entries_hash.values.length - 1)
      next if entries_to_delete_arr.keys.include?(key)
      
      entry = added_entries_hash.values[key]
      
      tap_when_element_exists "* marked:'#{entry[:amount]}x #{entry[:Article][:name]}' " \
        "sibling * marked:'Expiration date: " + entry[:expiration_date].strftime('%-m/%-d/%y') + "' " \
        "parent * sibling AppCompatCheckBox"
      
      entries_to_delete_arr[key] = entry 
      break
    end
  end
  
  @entryHelper.memorize(entries_to_delete_arr.values, "the selected product entries")
end

When /^I choose to delete the selected items$/ do
  press_menu_button
  tap_when_element_exists("DropDownListView * text:'Delete selected'")
end

Then /^I should be asked, if I really want to delete the entries$/ do
  wait_for_element_exists("* text:'Are you sure you wish to delete the selected products?'")
end

Then /^the selected product entries should no longer be in the list$/ do
  selected_entries = @entryHelper.recall("the selected product entries")
  
  selected_entries.each do |entry|
    queryResult = query("* marked:'#{entry[:amount]}x #{entry[:Article][:name]}' " \
         "sibling * marked:'Expiration date: " + entry[:expiration_date].strftime('%-m/%-d/%y') + "'")
    expect(queryResult.length).to be == 0, "entry in list"
  end
end

When /^I try to delete that entry$/ do
  step('I open the edit product screen for that product entry')
  step('I press the delete button')
  step('I should be asked, if I really want to delete the entry')
  step('I answer yes')
  step('I should see that deleting succeeded')
  step('the product entry should no longer be in the list')
  
  entry = @entryHelper.recall('the product entry')
  @entryHelper.memorize(entry, 'the deleted product entry')
end