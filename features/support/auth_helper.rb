require 'rspec'
require 'calabash-android/operations'
require './features/support/memory_mixin.rb'

module CucumberExpirySyncHelpers
  class AuthHelper
    include RSpec::Matchers
    include Calabash::Android::Operations
    include MemoryMixin
    
    attr_accessor :world
    
    def initialize(world)
      @world = world
    end
    
    def logged_in?(user = nil)
      @world.step("I open the main menu")
      
      logoutButton = query("DropDownListView * marked:'Logout'")
      return false unless logoutButton.empty?
        
      unless user.nil?
        logoutButton = query("DropDownListView * marked:'Logout " + (user[:email_address].empty? ? user[:account_name] : user[:email_address] ) + "'")
        return false if logoutButton.empty?
      end
        
      press_back_button
      true
    end
  end
end

World(CucumberExpirySyncHelpers)